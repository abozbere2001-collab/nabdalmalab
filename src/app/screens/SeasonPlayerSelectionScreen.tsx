

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Player, SeasonPrediction } from '@/lib/types';
import { CURRENT_SEASON } from '@/lib/constants';
import { Loader2, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { FootballIcon } from '@/components/icons/FootballIcon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';

const API_FOOTBALL_HOST = 'v3.football.api-sports.io';
const API_KEY = "d3d0510e975b2b9754dd4ae29b76c99a";

interface SeasonPlayerSelectionScreenProps extends ScreenProps {
    leagueId: number;
    leagueName: string;
    teamId: number;
    teamName:string;
}

interface PlayerResponse {
    player: Player;
    statistics: any[];
}


const PlayerListItem = React.memo(({ player, isPredictedTopScorer, onScorerSelect, disabled }: { player: Player, isPredictedTopScorer: boolean, onScorerSelect: (playerId: number) => void, disabled: boolean }) => {
    return (
        <div className="flex items-center p-2 border rounded-lg bg-card">
             <div className="flex-1 flex items-center gap-3">
                <Avatar className="h-10 w-10"><AvatarImage src={player.photo} /></Avatar>
                <div>
                   <p className="font-semibold">{player.name}</p>
                   <p className="text-xs text-muted-foreground">{player.position}</p>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onScorerSelect(player.id)} disabled={disabled}>
                <FootballIcon className={cn("h-6 w-6 text-muted-foreground transition-colors", isPredictedTopScorer && "text-yellow-400")} />
            </Button>
        </div>
    );
});
PlayerListItem.displayName = 'PlayerListItem';


export function SeasonPlayerSelectionScreen({ navigate, goBack, canGoBack, headerActions, leagueId, leagueName, teamId, teamName }: SeasonPlayerSelectionScreenProps) {
    const { user } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();
    const [players, setPlayers] = useState<PlayerResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [savedTopScorerId, setSavedTopScorerId] = useState<number | undefined>();
    const [stagedTopScorerId, setStagedTopScorerId] = useState<number | undefined>();

    const hasPredictionBeenSaved = !!savedTopScorerId;


    const privatePredictionDocRef = useMemo(() => {
        if (!user || !db) return null;
        return doc(db, 'seasonPredictions', `${user.uid}_${leagueId}_${CURRENT_SEASON}`);
    }, [user, db, leagueId]);

    // Fetch players with pagination
    useEffect(() => {
        const fetchAllPlayers = async () => {
            setLoading(true);
            const playerMap = new Map<number, PlayerResponse>();
            let currentPage = 1;
            let totalPages = 1;

            try {
                while (currentPage <= totalPages) {
                    const res = await fetch(`https://${API_FOOTBALL_HOST}/players?team=${teamId}&season=${CURRENT_SEASON}&page=${currentPage}`, { headers: { 'x-rapidapi-host': API_FOOTBALL_HOST, 'x-rapidapi-key': API_KEY } });
                    const data = await res.json();
                    
                    if (data.response) {
                        data.response.forEach((playerResponse: PlayerResponse) => {
                            if (!playerMap.has(playerResponse.player.id)) {
                                const translatedPlayer = {
                                    ...playerResponse,
                                    player: {
                                        ...playerResponse.player,
                                        name: hardcodedTranslations.players[playerResponse.player.id] || playerResponse.player.name
                                    }
                                };
                                playerMap.set(playerResponse.player.id, translatedPlayer);
                            }
                        });
                    }

                    if (data.paging && data.paging.total > currentPage) {
                        totalPages = data.paging.total;
                        currentPage++;
                    } else {
                        break;
                    }
                }
                setPlayers(Array.from(playerMap.values()));
            } catch (e) {
                console.error('Failed to fetch players:', e);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل اللاعبين.' });
            } finally {
                setLoading(false);
            }
        };

        fetchAllPlayers();
    }, [teamId, toast]);

    // Fetch existing prediction
    useEffect(() => {
        if (!privatePredictionDocRef) return;
        getDoc(privatePredictionDocRef)
            .then(docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as SeasonPrediction;
                    if(data.predictedTopScorerId) {
                        setSavedTopScorerId(data.predictedTopScorerId);
                        setStagedTopScorerId(data.predictedTopScorerId);
                    }
                }
            })
            .catch(error => {
                const permissionError = new FirestorePermissionError({ path: privatePredictionDocRef.path, operation: 'get' });
                errorEmitter.emit('permission-error', permissionError);
            });
    }, [privatePredictionDocRef]);
    
    const handleStagingSelect = (playerId: number) => {
        if (hasPredictionBeenSaved) {
             toast({
                variant: 'destructive',
                title: 'التوقع مقفل',
                description: 'لقد قمت بتثبيت توقعك لهذا الموسم ولا يمكن تغييره.',
            });
            return;
        }
        setStagedTopScorerId(prev => prev === playerId ? undefined : playerId);
    };

    const handleSavePrediction = useCallback(async () => {
        if (hasPredictionBeenSaved || !stagedTopScorerId || !privatePredictionDocRef || !user || !db) return;
        
        setSaving(true);
        const privateData: Partial<SeasonPrediction> = {
            userId: user.uid,
            leagueId: leagueId,
            leagueName: leagueName,
            season: CURRENT_SEASON,
            predictedTopScorerId: stagedTopScorerId,
            timestamp: new Date(),
        };

        // Ensure the document exists before updating
        await setDoc(privatePredictionDocRef, {}, { merge: true });

        setDoc(privatePredictionDocRef, privateData, { merge: true })
            .then(() => {
                toast({
                    title: 'تم حفظ التوقع',
                    description: 'تم تسجيل توقعك لهداف الموسم بنجاح.',
                });
                setSavedTopScorerId(stagedTopScorerId);
            })
            .catch((serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: privatePredictionDocRef.path,
                    operation: 'update',
                    requestResourceData: privateData
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setSaving(false);
            });

    }, [stagedTopScorerId, privatePredictionDocRef, user, db, leagueId, leagueName, hasPredictionBeenSaved, toast]);
    
    const showSaveButton = !hasPredictionBeenSaved && stagedTopScorerId !== undefined;

    if (loading) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title={`اختيار هداف من ${teamName}`} onBack={goBack} canGoBack={true} />
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title={`اختيار هداف من ${teamName}`} onBack={goBack} canGoBack={true} />
             <div className='p-4 text-center text-sm text-muted-foreground border-b'>
                <p>
                    {hasPredictionBeenSaved
                        ? 'لقد قمت بتثبيت توقعك لهداف هذا الدوري.'
                        : 'اختر الهداف المتوقع للدوري بالضغط على أيقونة الكرة.'}
                </p>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                {players.length > 0 ? (
                     players.map(playerResponse => {
                        const { player } = playerResponse;
                        if (!player) return null;
                        return (
                            <PlayerListItem
                                key={player.id}
                                player={player}
                                isPredictedTopScorer={stagedTopScorerId === player.id}
                                onScorerSelect={handleStagingSelect}
                                disabled={hasPredictionBeenSaved && stagedTopScorerId !== player.id}
                            />
                        );
                    })
                ) : (
                    <p className="text-center pt-8 text-muted-foreground">لا يوجد لاعبون متاحون لهذا الفريق.</p>
                )}
                </div>
            </ScrollArea>

            {showSaveButton && (
                <div className="p-4 border-t bg-background/90 backdrop-blur-sm sticky bottom-0">
                    <Button className="w-full" size="lg" onClick={handleSavePrediction} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" /> حفظ توقع الهداف</>}
                    </Button>
                </div>
            )}
        </div>
    );
}
