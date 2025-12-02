

"use client";

import React from 'react';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Star, Pencil, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ManagedCompetition } from '@/lib/types';

interface LeagueHeaderItemProps {
    league: ManagedCompetition;
    isFavorited: boolean;
    onFavoriteToggle: () => void;
    onClick: () => void;
    isAdmin: boolean;
    onRename: () => void;
    followerCount?: number;
}

export function LeagueHeaderItem({ league, isFavorited, onFavoriteToggle, onClick, isAdmin, onRename, followerCount }: LeagueHeaderItemProps) {
    return (
        <li className="flex w-full items-center justify-between p-3 h-12 hover:bg-accent/80 transition-colors rounded-md bg-card border">
            <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={onClick}>
                <Avatar className="h-6 w-6 p-0.5">
                    <AvatarImage src={league.logo} alt={league.name} className="object-contain" />
                </Avatar>
                <span className="text-sm truncate font-bold">{league.name}</span>
            </div>
            <div className="flex items-center gap-1">
                 {isAdmin && followerCount !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{followerCount}</span>
                    </div>
                )}
                {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onRename(); }}>
                        <Pencil className="h-4 w-4 text-muted-foreground/80" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onFavoriteToggle(); }}>
                    <Star className={cn("h-5 w-5 text-muted-foreground/50", isFavorited && "text-yellow-400 fill-current")} />
                </Button>
            </div>
        </li>
    );
}
