
"use client";
import { Star, Newspaper, MoreHorizontal, Shield, UserCircle2, Flag, Home, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScreenKey } from '@/app/page';
import { FootballIcon } from './icons/FootballIcon';
import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Crown } from 'lucide-react';

interface BottomNavProps {
  activeScreen: ScreenKey;
  onNavigate: (screen: ScreenKey) => void;
}

export function BottomNav({ activeScreen, onNavigate }: BottomNavProps) {
  
  const navItems: { key: ScreenKey; label: string; icon: React.ElementType }[] = [
    { key: 'Matches', label: "المباريات", icon: Shield },
    { key: 'MyCountry', label: "ملعبي", icon: Home },
    { key: 'Predictions', label: "التوقعات", icon: Trophy },
    { key: 'Competitions', label: "اختياراتي", icon: Star },
    { key: 'News', label: "أخبار", icon: Newspaper },
    { key: 'Settings', label: "المزيد", icon: MoreHorizontal },
  ];
  
  const handleNavigation = (key: ScreenKey) => {
    if (navItems.some(item => item.key === key)) {
      onNavigate(key);
    }
  };

  return (
    <div className="h-14 flex-shrink-0 border-t bg-bottom-nav text-bottom-nav-foreground">
      <nav className="flex h-full items-center justify-around px-1 max-w-md mx-auto">
        {navItems.map(({ key, label, icon: Icon }) => {
          const isActive = activeScreen === key;

          return (
             <button
              key={key}
              onClick={() => handleNavigation(key as ScreenKey)}
              className={cn(
                'relative flex h-full flex-col items-center justify-center gap-0.5 px-1 text-center text-xs font-medium outline-none transition-colors w-[60px]',
                isActive ? 'text-bottom-nav-active' : 'text-bottom-nav-foreground hover:text-bottom-nav-active'
              )}
            >
                <div className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    isActive ? "bg-bottom-nav-active/20" : ""
                )}>
                    <Icon className="h-5 w-5" />
                </div>
              <span className={cn("text-[10px]", isActive ? "font-bold" : "font-medium")}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
