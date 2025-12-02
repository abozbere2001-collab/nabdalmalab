

"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, addDays, subDays, isToday, isYesterday, isTomorrow, startOfToday } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, collection, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { Loader2, Search, Star, Crown, ChevronLeft, ChevronRight, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Button } from '@/components/ui/button';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import type { Fixture as FixtureType, Favorites, PredictionMatch } from '@/lib/types';
import { FixtureItem } from '@/components/FixtureItem';
import { hardcodedTranslations } from '@/lib/hardcoded-translations';
import { POPULAR_LEAGUES } from '@/lib/popular-data';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const API_FOOTBALL_HOST = 'v3.football.api-sports.io';
const API_KEY = "d3d0510e975b2b9754dd4ae29b76c99a";

interface GroupedFixtures {
    [leagueName: string]: {
        league: FixtureType['league'];
        fixtures: FixtureType[];
    }
}

const popularLeagueIds = new Set(POPULAR_LEAGUES.slice(0, 15).map(l => l.id));

const FixturesList = React.memo((props: { 
    fixtures: FixtureType[], 
    loading: boolean,
    hasAnyFavorites: boolean,
    favoritedLeagueIds: number[],
    favoritedTeamIds: number[],
    navigate: ScreenProps['navigate'],
    pinnedPredictionMatches: Set<number>,
    onPinToggle: (fixture: FixtureType) => void,
    isAdmin: boolean,
    showOdds?: boolean,
}) => {
    
    const { favoriteTeamMatches, otherFixtures } = useMemo(() => {
        let favoriteTeamMatches: FixtureType[] = [];
        let otherFixturesList: FixtureType[] = [];

         if (props.hasAnyFavorites) {
             props.fixtures.forEach(f => {
                if (props.favoritedTeamIds.includes(f.teams.home.id) || props.favoritedTeamIds.includes(f.teams.away.id)) {
                    favoriteTeamMatches.push(f);
                } else if (props.favoritedLeagueIds.includes(f.league.id)) {
                    otherFixturesList.push(f);
                }
            });
        } else {
             // If no favorites, show popular leagues only
            otherFixturesList = props.fixtures.filter(f => popularLeagueIds.has(f.league.id));
        }

        return { favoriteTeamMatches, otherFixtures: otherFixturesList };

    }, [props.fixtures, props.favoritedTeamIds, props.favoritedLeagueIds, props.hasAnyFavorites]);


    const groupedOtherFixtures = useMemo(() => {
        return otherFixtures.reduce((acc, fixture) => {
            const leagueName = fixture.league.name;
            if (!acc[leagueName]) {
                acc[leagueName] = { league: fixture.league, fixtures: [] };
            }
            acc[leagueName].fixtures.push(fixture);
            return acc;
        }, {} as GroupedFixtures);
    }, [otherFixtures]);


    if (props.loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    const totalFixturesToShow = favoriteTeamMatches.length + otherFixtures.length;

    if (totalFixturesToShow === 0) {
        const message = props.hasAnyFavorites ? "لا توجد مباريات لمفضلاتك في هذا اليوم." : "لا توجد مباريات لهذا اليوم.";
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-64 p-4">
                <p>{message}</p>
                <Button className="mt-4" onClick={() => props.navigate('AllCompetitions')}>استكشف البطولات</Button>
            </div>
        );
    }
    
    const sortedLeagues = Object.keys(groupedOtherFixtures).sort((a,b) => a.localeCompare(b));

    return (
        <div className="space-y-4">
            {favoriteTeamMatches.length > 0 && (
                 <div>
                    <div className="font-semibold text-foreground py-1 px-3 rounded-md bg-card border flex items-center gap-2 text-xs h-6">
                        <Star className="h-4 w-4 text-yellow-400" />
                        <span className="truncate">مباريات فرقك المفضلة</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                        {favoriteTeamMatches.map(f => (
                            <FixtureItem 
                                key={f.fixture.id} 
                                fixture={f} 
                                navigate={props.navigate}
                                isPinnedForPrediction={props.pinnedPredictionMatches.has(f.fixture.id)}
                                onPinToggle={props.onPinToggle}
                                isAdmin={props.isAdmin}
                                showOdds={props.showOdds}
                            />
                        ))}
                    </div>
                </div>
            )}

            {sortedLeagues.map(leagueName => {
                const { league, fixtures: leagueFixtures } = groupedOtherFixtures[leagueName];
                return (
                    <div key={`${league.id}-${league.name}`}>
                       <div className="font-semibold text-foreground py-1 px-3 rounded-md bg-card border flex items-center gap-2 text-xs h-6 cursor-pointer" onClick={() => props.navigate('CompetitionDetails', { leagueId: league.id, title: league.name, logo: league.logo })}>
                           <Avatar className="h-4 w-4"><AvatarImage src={league.logo} alt={league.name} /></Avatar>
                           <span className="truncate">{league.name}</span>
                       </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pt-1">
                            {leagueFixtures.map(f => (
                                <FixtureItem 
                                    key={f.fixture.id} 
                                    fixture={f} 
                                    navigate={props.navigate}
                                    isPinnedForPrediction={props.pinnedPredictionMatches.has(f.fixture.id)}
                                    onPinToggle={props.onPinToggle}
                                    isAdmin={props.isAdmin}
                                    showOdds={props.showOdds}
                                />
                            ))}
                        </div>
                    </div>
                )
            })}
        </div>
    );
});
FixturesList.displayName = 'FixturesList';


const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');

const DateScroller = ({ selectedDateKey, onDateSelect }: {selectedDateKey: string, onDateSelect: (dateKey: string) => void}) => {
    const dates = useMemo(() => {
        const today = new Date();
        return Array.from({ length: 731 }, (_, i) => addDays(today, i - 365));
    }, []);
    
    const scrollerRef = useRef<HTMLDivElement>(null);
    const selectedButtonRef = useRef<HTMLButtonElement>(null);
    const isTodaySelected = selectedDateKey === formatDateKey(new Date());


    useEffect(() => {
        const scroller = scrollerRef.current;
        const selectedButton = selectedButtonRef.current;

        if (scroller && selectedButton) {
            const scrollerRect = scroller.getBoundingClientRect();
            const selectedRect = selectedButton.getBoundingClientRect();
            // Calculate the scroll position to center the selected button
            const scrollOffset = selectedRect.left - scrollerRect.left - (scrollerRect.width / 2) + (selectedRect.width / 2);
            scroller.scrollTo({ left: scroller.scrollLeft + scrollOffset, behavior: 'smooth' });
        }
    }, [selectedDateKey]); // Re-run when the selected date changes

    return (
        <div className="relative bg-[var(--date-scroller-background)] shadow-md h-[30px] flex items-center justify-center">
             <Button 
                variant="ghost" 
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-white/20 text-[var(--date-scroller-foreground)]"
                onClick={() => onDateSelect(formatDateKey(addDays(new Date(selectedDateKey), 1)))}
             >
                <ChevronRight className="h-5 w-5" />
             </Button>

            {!isTodaySelected && (
                <Button 
                    variant="secondary"
                    size="sm"
                    className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 h-6 rounded-full z-20 bg-background/80 text-foreground border border-border backdrop-blur-sm animate-in fade-in zoom-in-95 px-2"
                    onClick={() => onDateSelect(formatDateKey(new Date()))}
                >
                    <CalendarClock className="h-3 w-3 ml-1" />
                    <span className="text-xs">اليوم</span>
                </Button>
            )}

            <div ref={scrollerRef} className="flex-1 flex flex-row-reverse overflow-x-auto pb-1 px-10" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {dates.map(date => {
                    const dateKey = formatDateKey(date);
                    const isSelected = dateKey === selectedDateKey;
                    const dayLabel = isToday(date) ? "اليوم" : isYesterday(date) ? "الأمس" : isTomorrow(date) ? "غداً" : format(date, "EEE", { locale: ar });

                    return (
                         <button
                            key={dateKey}
                            ref={isSelected ? selectedButtonRef : null}
                            className={cn(
                                "relative flex items-center justify-center h-full px-3 min-w-[50px] rounded-lg transition-colors ml-2",
                                "text-[var(--date-scroller-foreground)] hover:bg-white/20",
                                isSelected && "text-[var(--date-scroller-active-foreground)] bg-[var(--date-scroller-active-background)]"
                            )}
                            onClick={() => onDateSelect(dateKey)}
                        >
                           <span className="text-[11px] font-semibold flex items-center gap-1.5">
                                <span className="font-normal">{dayLabel}</span>
                                <span>{format(date, 'd')}</span>
                            </span>
                        </button>
                    )
                })}
            </div>
             <Button 
                variant="ghost" 
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-white/20 text-[var(--date-scroller-foreground)]"
                onClick={() => onDateSelect(formatDateKey(subDays(new Date(selectedDateKey), 1)))}
             >
                <ChevronLeft className="h-5 w-5" />
             </Button>
        </div>
    );
}

// Global cache outside the component to persist across re-renders and tab switches
const matchesCache = new Map<string, FixtureType[]>();

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack, isVisible, favorites, customNames, setFavorites, onCustomNameChange }: ScreenProps & { isVisible: boolean, setFavorites: React.Dispatch<React.SetStateAction<Partial<Favorites>>>, onCustomNameChange: () => Promise<void> }) {
  const { user } = useAuth();
  const { db, isAdmin } = useAdmin();
  const { toast } = useToast();
  const [showOdds, setShowOdds] = useState(false);
  
  const [selectedDateKey, setSelectedDateKey] = useState<string>(formatDateKey(new Date()));
  
  // Use a state to trigger re-renders when the cache is updated.
  const [cacheVersion, setCacheVersion] = useState(0);
  const [loading, setLoading] = useState(true);
    
  const [pinnedPredictionMatches, setPinnedPredictionMatches] = useState(new Set<number>());

  useEffect(() => {
    if (!db || !isAdmin) return;
    const q = collection(db, "predictionFixtures");
    const unsub = onSnapshot(q, (snapshot) => {
        const newPinnedSet = new Set<number>();
        snapshot.forEach(doc => newPinnedSet.add(Number(doc.id)));
        setPinnedPredictionMatches(newPinnedSet);
    }, (error) => {
        console.error("Permission error listening to predictions:", error);
    });
    return () => unsub();
  }, [db, isAdmin]);

  const getDisplayName = useCallback((type: 'team' | 'league', id: number, defaultName: string) => {
    if (!customNames) return defaultName;
    const firestoreMap = type === 'team' ? customNames?.teams : customNames?.leagues;
    const customName = firestoreMap?.get(id);
    if (customName) return customName;

    const hardcodedMap = type === 'team' ? hardcodedTranslations.teams : hardcodedTranslations.leagues;
    const hardcodedName = hardcodedMap[id as any];
    if(hardcodedName) return hardcodedName;

    return defaultName;
}, [customNames]);


  const handlePinToggle = useCallback((fixture: FixtureType) => {
    if (!db) return;
    const fixtureId = fixture.fixture.id;
    const isPinned = pinnedPredictionMatches.has(fixtureId);
    const docRef = doc(db, 'predictionFixtures', String(fixtureId));

    if (isPinned) {
        deleteDoc(docRef).then(() => {
            toast({ title: "تم إلغاء التثبيت", description: "تمت إزالة المباراة من التوقعات." });
        }).catch(err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'delete' }));
        });
    } else {
        const data: PredictionMatch = { fixtureData: fixture };
        setDoc(docRef, data).then(() => {
            toast({ title: "تم التثبيت", description: "أصبحت المباراة متاحة الآن للتوقع." });
        }).catch(err => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: docRef.path, operation: 'create', requestResourceData: data }));
        });
    }
  }, [db, pinnedPredictionMatches, toast]);

    const fetchAndProcessData = useCallback(async (dateKey: string, abortSignal: AbortSignal) => {
        setLoading(true);

        try {
            const res = await fetch(`https://${API_FOOTBALL_HOST}/fixtures?date=${dateKey}`, { 
                signal: abortSignal,
                headers: {
                    'x-rapidapi-host': API_FOOTBALL_HOST,
                    'x-rapidapi-key': API_KEY || '',
                },
             });
            if (!res.ok) throw new Error(`API fetch failed with status ${res.status}`);
            
            const data = await res.json();
            if (abortSignal.aborted) return;
            
            const allFixturesToday: FixtureType[] = data.response || [];
            
            const processedFixtures = allFixturesToday.map(fixture => ({
                ...fixture,
                league: { ...fixture.league, name: getDisplayName('league', fixture.league.id, fixture.league.name) },
                teams: {
                    home: { ...fixture.teams.home, name: getDisplayName('team', fixture.teams.home.id, fixture.teams.home.name) },
                    away: { ...fixture.teams.away, name: getDisplayName('team', fixture.teams.away.id, fixture.teams.away.name) }
                }
            }));
            
            matchesCache.set(dateKey, processedFixtures);
            setCacheVersion(v => v + 1);

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error(`Failed to fetch data for ${dateKey}:`, error);
                matchesCache.set(dateKey, []); // Cache empty array on error
                setCacheVersion(v => v + 1);
            }
        } finally {
            if (!abortSignal.aborted) setLoading(false);
        }
    }, [getDisplayName]);

    const updateLiveData = useCallback(async (dateKey: string, abortSignal: AbortSignal) => {
        const cachedFixtures = matchesCache.get(dateKey);
        if (!cachedFixtures) return;

        const liveFixtureIds = cachedFixtures
            .filter(f => f.fixture.status.short !== 'FT' && f.fixture.status.short !== 'PST' && f.fixture.status.short !== 'CANC')
            .map(f => f.fixture.id);

        if (liveFixtureIds.length === 0) return;
        
        try {
            const res = await fetch(`https://${API_FOOTBALL_HOST}/fixtures?ids=${liveFixtureIds.join('-')}`, { 
                signal: abortSignal,
                headers: {
                    'x-rapidapi-host': API_FOOTBALL_HOST,
                    'x-rapidapi-key': API_KEY || '',
                },
            });
            if (!res.ok) return;

            const data = await res.json();
            if (abortSignal.aborted || !data.response) return;

            const updatedFixturesMap = new Map(data.response.map((f: FixtureType) => [f.fixture.id, f]));
            
            const newFixtures = cachedFixtures.map(oldFixture => {
                const updatedFixture = updatedFixturesMap.get(oldFixture.fixture.id);
                return updatedFixture ? {
                    ...updatedFixture,
                    league: { ...updatedFixture.league, name: getDisplayName('league', updatedFixture.league.id, updatedFixture.league.name) },
                    teams: {
                        home: { ...updatedFixture.teams.home, name: getDisplayName('team', updatedFixture.teams.home.id, updatedFixture.teams.home.name) },
                        away: { ...updatedFixture.teams.away, name: getDisplayName('team', updatedFixture.teams.away.id, updatedFixture.teams.away.name) }
                    }
                } : oldFixture;
            });
            
            matchesCache.set(dateKey, newFixtures);
            setCacheVersion(v => v + 1);

        } catch (error: any) {
            if (error.name !== 'AbortError') console.error("Live update failed:", error);
        }

    }, [getDisplayName]);

  
  useEffect(() => {
      if (!isVisible || !customNames) return;

      const controller = new AbortController();
      
      if (!matchesCache.has(selectedDateKey)) {
          fetchAndProcessData(selectedDateKey, controller.signal);
      } else {
          setLoading(false);
      }
      
      const interval = setInterval(() => {
          if (document.visibilityState === 'visible') {
            updateLiveData(selectedDateKey, controller.signal);
          }
      }, 60000);

      return () => {
          controller.abort();
          clearInterval(interval);
      };

  }, [selectedDateKey, isVisible, customNames, fetchAndProcessData, updateLiveData]);


  const handleDateChange = (dateKey: string) => {
      setSelectedDateKey(dateKey);
  };
  
  const favoritedTeamIds = useMemo(() => (favorites && favorites.teams) ? Object.keys(favorites.teams).map(Number) : [], [favorites]);
  const favoritedLeagueIds = useMemo(() => (favorites && favorites.leagues) ? Object.keys(favorites.leagues).map(Number) : [], [favorites]);
  const hasAnyFavorites = favoritedLeagueIds.length > 0 || favoritedTeamIds.length > 0;
  
  const allFixturesForDay = matchesCache.get(selectedDateKey) || [];

    
  return (
    <div className="flex h-full flex-col bg-background">
        <ScreenHeader 
            title="المباريات" 
            canGoBack={false}
            onBack={() => {}} 
            actions={
               <div className="flex items-center gap-0.5">
                  <div
                    onClick={() => setShowOdds(prev => !prev)}
                    className={cn("flex items-center justify-center h-8 w-8 rounded-md cursor-pointer", showOdds ? 'bg-black/20' : 'hover:bg-white/20')}
                  >
                    <span className="text-xs font-mono select-none">1x2</span>
                  </div>
                  <SearchSheet navigate={navigate} favorites={favorites} customNames={customNames} setFavorites={setFavorites} onCustomNameChange={onCustomNameChange!}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/20">
                          <Search className="h-5 w-5" />
                      </Button>
                  </SearchSheet>
                  <ProfileButton />
              </div>
            }
        />
        
        <div className="flex flex-1 flex-col min-h-0">
             <div className="sticky top-0 z-10">
                 <DateScroller selectedDateKey={selectedDateKey} onDateSelect={handleDateChange} />
            </div>
            
            <div className="flex-1 overflow-y-auto p-1 space-y-4 mt-2">
                <FixturesList 
                    fixtures={allFixturesForDay}
                    loading={loading}
                    favoritedLeagueIds={favoritedLeagueIds}
                    favoritedTeamIds={favoritedTeamIds}
                    hasAnyFavorites={hasAnyFavorites}
                    navigate={navigate}
                    pinnedPredictionMatches={pinnedPredictionMatches}
                    onPinToggle={handlePinToggle}
                    isAdmin={isAdmin}
                    showOdds={showOdds}
                />
            </div>

        </div>
    </div>
  );
}

    

    