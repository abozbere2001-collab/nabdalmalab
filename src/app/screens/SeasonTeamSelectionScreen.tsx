

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth, useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Team, SeasonPrediction } from '@/lib/types';
import { CURRENT_SEASON } from '@/lib/constants';
import { Loader2, Trophy, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { FixedSizeList as List } from 'react-window';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';

const API_KEY = "d3d0510e975b2b9754dd4ae29b76c99a";

interface SeasonTeamSelectionScreenProps extends ScreenProps {
    leagueId: number;
    leagueName: string;
}

const TeamListItem = React.memo(({ team, isPredictedChampion, onChampionSelect, onTeamClick, disabled }: { team: Team, isPredictedChampion: boolean, onChampionSelect: () => void, onTeamClick: () => void, disabled: boolean }) => {
    return (
        <div className="flex items-center p-2 border rounded-lg bg-card">
            <div 
                className="flex-1 flex items-center gap-3 cursor-pointer"
                onClick={onTeamClick}
            >
                <Avatar className="h-8 w-8"><AvatarImage src={team.logo} /></Avatar>
                <span className="font-semibold">{team.name}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={onChampionSelect} disabled={disabled}>
                <Trophy className={cn("h-6 w-6 text-muted-foreground transition-colors", isPredictedChampion && "text-yellow-400 fill-current")} />
            </Button>
        </div>
    );
});
TeamListItem.displayName = 'TeamListItem';


export function SeasonTeamSelectionScreen({ navigate, goBack, canGoBack, headerActions, leagueId, leagueName }: SeasonTeamSelectionScreenProps) {
    const { user } = useAuth();
    const { db } = useFirestore();
    const { toast } = useToast();
    const [teams, setTeams] = useState<{ team: Team }[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Tracks the saved prediction from Firestore
    const [savedChampionId, setSavedChampionId] = useState<number | undefined>();
    // Tracks the user's current selection before saving
    const [stagedChampionId, setStagedChampionId] = useState<number | undefined>();
    
    const hasPredictionBeenSaved = !!savedChampionId;


    const privatePredictionDocRef = useMemo(() => {
        if (!user || !db) return null;
        return doc(db, 'seasonPredictions', `${user.uid}_${leagueId}_${CURRENT_SEASON}`);
    }, [user, db, leagueId]);

    // Fetch teams
    useEffect(() => {
        setLoading(true);
        const fetchTeams = async () => {
            try {
                const res = await fetch(`/api/football/teams?league=${leagueId}&season=${CURRENT_SEASON}`);
                const data = await res.json();
                const rawTeams = data.response || [];
                const translatedTeams = rawTeams.map((teamData: { team: Team }) => ({
                    ...teamData,
                    team: {
                        ...teamData.team,
                        name: hardcodedTranslations.teams[teamData.team.id] || teamData.team.name,
                    }
                }));
                setTeams(translatedTeams);
            } catch (e) {
                console.error('Failed to fetch teams:', e);
                toast({ variant: 'destructive', title: 'خطأ', description: 'فشل في تحميل الفرق.' });
            } finally {
                setLoading(false);
            }
        };
        fetchTeams();
    }, [leagueId, toast]);

    // Fetch existing prediction
    useEffect(() => {
        if (!privatePredictionDocRef) return;
        getDoc(privatePredictionDocRef)
            .then(docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as SeasonPrediction;
                    if(data.predictedChampionId) {
                        setSavedChampionId(data.predictedChampionId);
                        setStagedChampionId(data.predictedChampionId);
                    }
                }
            })
            .catch(error => {
                const permissionError = new FirestorePermissionError({ path: privatePredictionDocRef.path, operation: 'get' });
                errorEmitter.emit('permission-error', permissionError);
            });
    }, [privatePredictionDocRef]);
    
    const handleStagingSelect = (teamId: number) => {
        if (hasPredictionBeenSaved) {
            toast({
                variant: 'destructive',
                title: 'التوقع مقفل',
                description: 'لقد قمت بتثبيت توقعك لهذا الموسم ولا يمكن تغييره.',
            });
            return;
        }
        setStagedChampionId(prev => prev === teamId ? undefined : teamId);
    };


    const handleSavePrediction = useCallback(async () => {
        if (hasPredictionBeenSaved || !stagedChampionId || !privatePredictionDocRef || !user || !db) return;
        
        setSaving(true);

        const privateData: Partial<SeasonPrediction> = {
            userId: user.uid,
            leagueId,
            leagueName,
            season: CURRENT_SEASON,
            predictedChampionId: stagedChampionId,
            timestamp: new Date()
        };
        
        // Ensure the document exists before updating
        await setDoc(privatePredictionDocRef, {}, { merge: true });

        setDoc(privatePredictionDocRef, privateData, { merge: true })
            .then(() => {
                toast({
                    title: 'تم حفظ التوقع',
                    description: 'تم تسجيل توقعك لبطل الموسم بنجاح.',
                });
                setSavedChampionId(stagedChampionId);
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

    }, [stagedChampionId, privatePredictionDocRef, user, db, leagueId, leagueName, hasPredictionBeenSaved, toast]);


    const handleTeamClick = (teamId: number, teamName: string) => {
        navigate('SeasonPlayerSelection', { leagueId, leagueName, teamId, teamName });
    };

    const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const { team } = teams[index];
        if (!team) return null;
        return (
            <div style={style} className="px-4 py-1">
                <TeamListItem
                    team={team}
                    isPredictedChampion={stagedChampionId === team.id}
                    onChampionSelect={() => handleStagingSelect(team.id)}
                    onTeamClick={() => handleTeamClick(team.id, team.name)}
                    disabled={hasPredictionBeenSaved && stagedChampionId !== team.id}
                />
            </div>
        );
    };
    
    const showSaveButton = !hasPredictionBeenSaved && stagedChampionId !== undefined;

    if (loading) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title={`اختيار بطل ${leagueName}`} onBack={goBack} canGoBack={true} />
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            </div>
        );
    }
    
    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title={`توقع بطل ${leagueName}`} onBack={goBack} canGoBack={true} />
            <div className='p-4 text-center text-sm text-muted-foreground border-b'>
                 <p>
                    {hasPredictionBeenSaved 
                        ? 'لقد قمت بتثبيت توقعك لهذا الدوري. يمكنك الآن اختيار الهداف.'
                        : 'اختر الفريق البطل بالضغط على أيقونة الكأس.'
                    }
                </p>
                <p className="mt-2">ثم اضغط على أي فريق لاختيار الهداف من لاعبيه.</p>
            </div>
            <div className="flex-1 overflow-y-auto">
                {teams.length > 0 ? (
                     <List
                        height={window.innerHeight - (showSaveButton ? 220 : 150)}
                        itemCount={teams.length}
                        itemSize={68}
                        width="100%"
                    >
                        {Row}
                    </List>
                ) : (
                    <p className="text-center pt-8 text-muted-foreground">لا توجد فرق متاحة لهذا الدوري.</p>
                )}
            </div>
            
            {showSaveButton && (
                <div className="p-4 border-t bg-background/90 backdrop-blur-sm sticky bottom-0">
                    <Button className="w-full" size="lg" onClick={handleSavePrediction} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" /> حفظ التوقع</>}
                    </Button>
                </div>
            )}
        </div>
    );
}

    

    