

"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from './ui/button';
import { Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const API_FOOTBALL_HOST = 'v3.football.api-sports.io';
const API_KEY = "d3d0510e975b2b9754dd4ae29b76c99a";

interface OddValue {
    value: string;
    odd: string;
}

interface Bet {
    id: number;
    name: string;
    values: OddValue[];
}

interface Bookmaker {
    id: number;
    name: string;
    bets: Bet[];
}

interface OddsApiResponse {
    fixture: {
        id: number;
    };
    league: any;
    update: string;
    bookmakers: Bookmaker[];
}

interface FixtureApiResponse {
    teams: {
        home: { id: number; name: string; logo: string; };
        away: { id: number; name: string; logo: string; };
    };
    fixture: any;
}

interface ProcessedOdds {
    home: number;
    draw: number;
    away: number;
    homeTeamName: string;
    awayTeamName: string;
    homeTeamLogo: string;
    awayTeamLogo: string;
}

export function MatchOddsPopover({ fixtureId }: { fixtureId: number }) {
    const [odds, setOdds] = useState<ProcessedOdds | null>(null);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!isOpen || odds || loading) return;

        setLoading(true);

        const headers = {
            'x-rapidapi-host': API_FOOTBALL_HOST,
            'x-rapidapi-key': API_KEY || '',
        };

        Promise.all([
            fetch(`https://${API_FOOTBALL_HOST}/odds?fixture=${fixtureId}&bookmaker=8`, { headers }), // Bet365
            fetch(`https://${API_FOOTBALL_HOST}/fixtures?id=${fixtureId}`, { headers })
        ])
        .then(async ([oddsRes, fixtureRes]) => {
            if (!oddsRes.ok || !fixtureRes.ok) {
                throw new Error('Failed to fetch match data');
            }
            const oddsData = await oddsRes.json();
            const fixtureData = await fixtureRes.json();
            return { oddsData, fixtureData };
        })
        .then(({ oddsData, fixtureData }) => {
            const oddsResponse: OddsApiResponse | undefined = oddsData.response?.[0];
            const fixtureResponse: FixtureApiResponse | undefined = fixtureData.response?.[0];
            
            if (oddsResponse && fixtureResponse) {
                const bookmaker = oddsResponse.bookmakers.find((b: Bookmaker) => b.id === 8);
                const matchWinnerBet = bookmaker?.bets.find((b: Bet) => b.id === 1);
                
                if (matchWinnerBet && oddsResponse.update) {
                    const currentOdds: { [key: string]: number } = {};
                    matchWinnerBet.values.forEach((v: OddValue) => {
                       const key = v.value.toLowerCase().replace(' ', '');
                       currentOdds[key] = parseFloat(v.odd);
                    });

                    setOdds({
                        home: currentOdds.home,
                        draw: currentOdds.draw,
                        away: currentOdds.away,
                        homeTeamName: fixtureResponse.teams.home.name,
                        awayTeamName: fixtureResponse.teams.away.name,
                        homeTeamLogo: fixtureResponse.teams.home.logo,
                        awayTeamLogo: fixtureResponse.teams.away.logo,
                    });
                }
            }
        })
        .catch(console.error)
        .finally(() => setLoading(false));

    }, [isOpen, fixtureId, odds, loading]);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs px-2">1x2</Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="center" side="top">
                {loading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : odds ? (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm p-2 rounded-md bg-accent/50">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5"><AvatarImage src={odds.homeTeamLogo}/></Avatar>
                                <span className="font-semibold">{odds.homeTeamName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="font-bold text-base">{odds.home.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-sm p-2 rounded-md bg-accent/50">
                             <span className="font-semibold">تعادل</span>
                             <div className="flex items-center gap-1">
                                <span className="font-bold text-base">{odds.draw.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-sm p-2 rounded-md bg-accent/50">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5"><AvatarImage src={odds.awayTeamLogo}/></Avatar>
                                <span className="font-semibold">{odds.awayTeamName}</span>
                            </div>
                             <div className="flex items-center gap-1">
                                <span className="font-bold text-base">{odds.away.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-4 text-xs">
                        لا توجد احتمالات متاحة لهذه المباراة.
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

    