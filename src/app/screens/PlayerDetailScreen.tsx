

"use client";

import React, { useEffect, useState, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import type { Player, PlayerStats } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CURRENT_SEASON } from '@/lib/constants';
import { Separator } from '@/components/ui/separator';

const API_FOOTBALL_HOST = 'v3.football.api-sports.io';
const API_KEY = "e5cc7da36b2d056834aa64385f51c73f";

// --- TYPE DEFINITIONS ---
interface PlayerInfo extends Player {
    birth: { date: string; place: string; country: string; };
    nationality: string;
    height: string;
    weight:string;
    injured: boolean;
}

interface PlayerData {
    player: PlayerInfo;
    statistics: PlayerStats[];
}

interface Transfer {
    date: string;
    type: string;
    teams: {
        in: { id: number; name: string; logo: string; } | null;
        out: { id: number; name: string; logo: string; } | null;
    };
}


// --- SUB-COMPONENTS ---
const PlayerHeader = ({ player }: { player: PlayerInfo }) => (
    <Card className="mb-4 overflow-hidden">
        <div className="relative h-24 bg-gradient-to-r from-primary/20 to-accent/20">
            <Avatar className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-24 w-24 border-4 border-background">
                <AvatarImage src={player.photo} alt={player.name} />
                <AvatarFallback>{player.name.charAt(0)}</AvatarFallback>
            </Avatar>
        </div>
        <CardContent className="pt-16 text-center">
            <h1 className="text-2xl font-bold">{player.name}</h1>
            <p className="text-muted-foreground">{player.nationality}</p>
            <div className="mt-4 flex justify-center gap-6 text-sm">
                <div className="flex flex-col items-center">
                    <span className="font-bold">{player.age || '-'}</span>
                    <span className="text-xs text-muted-foreground">العمر</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="font-bold">{player.height || '-'}</span>
                    <span className="text-xs text-muted-foreground">الطول</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="font-bold">{player.weight || '-'}</span>
                    <span className="text-xs text-muted-foreground">الوزن</span>
                </div>
            </div>
        </CardContent>
    </Card>
);

const CurrentTeamStats = ({ statistics, navigate }: { statistics: PlayerStats[], navigate: ScreenProps['navigate'] }) => {
    if (statistics.length === 0) {
        return (
             <Card>
                <CardContent className="p-4 text-center text-muted-foreground">
                    لا توجد إحصائيات متاحة لهذا الموسم.
                </CardContent>
            </Card>
        );
    }
    const currentLeagueStats = statistics[0]; 

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">الأداء هذا الموسم ({currentLeagueStats.league.season})</CardTitle>
            </CardHeader>
            <CardContent>
                 <div 
                    className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-card-foreground/5 cursor-pointer"
                    onClick={() => navigate('CompetitionDetails', { leagueId: currentLeagueStats.league.id })}
                >
                    <Avatar className="h-12 w-12"><AvatarImage src={currentLeagueStats.team.logo} /></Avatar>
                    <div>
                        <p className="font-bold">{currentLeagueStats.team.name}</p>
                        <p className="text-xs text-muted-foreground">{currentLeagueStats.league.name}</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="font-bold text-xl">{currentLeagueStats.games.appearences || 0}</p>
                        <p className="text-xs text-muted-foreground">مباريات</p>
                    </div>
                    <div>
                        <p className="font-bold text-xl">{currentLeagueStats.goals.total || 0}</p>
                        <p className="text-xs text-muted-foreground">أهداف</p>
                    </div>
                    <div>
                        <p className="font-bold text-xl">{currentLeagueStats.goals.assists || 0}</p>
                        <p className="text-xs text-muted-foreground">صناعة</p>
                    </div>
                     <div>
                        <p className="font-bold text-xl">{currentLeagueStats.cards.yellow || 0}</p>
                        <p className="text-xs text-muted-foreground">بطاقات صفراء</p>
                    </div>
                     <div>
                        <p className="font-bold text-xl">{currentLeagueStats.cards.red + currentLeagueStats.cards.yellowred || 0}</p>
                        <p className="text-xs text-muted-foreground">بطاقات حمراء</p>
                    </div>
                     <div>
                        <p className="font-bold text-xl">{currentLeagueStats.games.rating ? parseFloat(currentLeagueStats.games.rating).toFixed(1) : '-'}</p>
                        <p className="text-xs text-muted-foreground">تقييم</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const CareerHistory = ({ transfers, navigate }: { transfers: Transfer[], navigate: ScreenProps['navigate'] }) => {
    const careerTeams = React.useMemo(() => {
        if (!transfers || transfers.length === 0) return [];
        const teamsMap = new Map<number, { name: string; logo: string }>();
        transfers.forEach(t => {
            if (t.teams?.in) teamsMap.set(t.teams.in.id, t.teams.in);
            if (t.teams?.out) teamsMap.set(t.teams.out.id, t.teams.out);
        });
        return Array.from(teamsMap.values()).reverse();
    }, [transfers]);

    if (careerTeams.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader><CardTitle className="text-lg">مسيرة اللاعب</CardTitle></CardHeader>
            <CardContent className="space-y-2">
                {careerTeams.map((team, index) => (
                    <React.Fragment key={team.id}>
                        <div 
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer"
                             onClick={() => navigate('TeamDetails', {teamId: team.id })}
                        >
                            <Avatar><AvatarImage src={team.logo} alt={team.name} /></Avatar>
                            <span className="font-semibold">{team.name}</span>
                        </div>
                        {index < careerTeams.length - 1 && <Separator />}
                    </React.Fragment>
                ))}
            </CardContent>
        </Card>
    );
}

// --- MAIN SCREEN COMPONENT ---
export function PlayerDetailScreen({ navigate, goBack, canGoBack, playerId }: ScreenProps & { playerId: number }) {
  const { db } = useFirestore();
  const [displayTitle, setDisplayTitle] = useState("ملف اللاعب");
  const [playerData, setPlayerData] = useState<PlayerData | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;

    const getPlayerInfo = async () => {
        setLoading(true);
        try {
            const headers = { 'x-rapidapi-host': API_FOOTBALL_HOST, 'x-rapidapi-key': API_KEY };
            // Fetch main player data for the current season
            const playerRes = await fetch(`https://${API_FOOTBALL_HOST}/players?id=${playerId}&season=${CURRENT_SEASON}`, { headers });
            if (playerRes.ok) {
                const data = await playerRes.json();
                if (data.response?.[0]) {
                    const playerInfo = data.response[0];
                    setPlayerData(playerInfo);
                    const name = playerInfo.player.name;

                    // Check for custom name in Firestore
                    if (db) {
                         const customNameDocRef = doc(db, "playerCustomizations", String(playerId));
                         try {
                             const customNameDocSnap = await getDoc(customNameDocRef);
                             if (customNameDocSnap.exists()) {
                                 setDisplayTitle(customNameDocSnap.data().customName);
                             } else {
                                setDisplayTitle(name);
                             }
                         } catch (error) {
                            const permissionError = new FirestorePermissionError({
                                path: customNameDocRef.path,
                                operation: 'get',
                            });
                            errorEmitter.emit('permission-error', permissionError);
                            setDisplayTitle(name); // fallback to original name
                         }
                    } else {
                        setDisplayTitle(name);
                    }
                }
            }

            // Fetch transfer data for career history
            const transferRes = await fetch(`https://${API_FOOTBALL_HOST}/transfers?player=${playerId}`, { headers });
            if (transferRes.ok) {
                 const data = await transferRes.json();
                 setTransfers(data.response || []);
            }

        } catch (error) {
            console.error("Error fetching player info:", error);
        } finally {
            setLoading(false);
        }
    };
    
    getPlayerInfo();
    
  }, [db, playerId]);

  if(loading) {
     return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="جاري التحميل..." onBack={goBack} canGoBack={canGoBack} />
             <div className="p-4 space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        </div>
    );
  }
  
  if(!playerData) {
     return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="خطأ" onBack={goBack} canGoBack={canGoBack} />
            <p className="text-center p-8">لم يتم العثور على بيانات اللاعب.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col bg-background h-full">
      <ScreenHeader 
        title={displayTitle}
        onBack={goBack} 
        canGoBack={canGoBack} 
      />
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <PlayerHeader player={{...playerData.player, name: displayTitle}} />
        <CurrentTeamStats statistics={playerData.statistics} navigate={navigate} />
        <CareerHistory transfers={transfers} navigate={navigate}/>
      </div>
    </div>
  );
}

    
