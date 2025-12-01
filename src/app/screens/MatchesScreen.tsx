
"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { ScreenProps } from '@/app/page';
import { format, addDays, subDays, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAdmin, useAuth, useFirestore } from '@/firebase/provider';
import { doc, onSnapshot, collection, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { Loader2, Search, Star, Crown, ChevronLeft, ChevronRight } from 'lucide-react';
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
        // Generate a range of 1 year back and 1 year forward (731 days total)
        return Array.from({ length: 731 }, (_, i) => addDays(today, i - 365));
    }, []);
    
    const scrollerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scroller = scrollerRef.current;
        if (!scroller) return;

        // Find the index of the selected date. 'today' is at index 365.
        const selectedIndex = dates.findIndex(d => formatDateKey(d) === selectedDateKey);
        if (selectedIndex === -1) return;

        // Find the DOM element for the selected button
        const selectedButton = scroller.children[selectedIndex] as HTMLElement;
        if (!selectedButton) return;
        
        const scrollerRect = scroller.getBoundingClientRect();
        const selectedRect = selectedButton.getBoundingClientRect();

        // Calculate the scroll position to center the selected button
        // The logic is: button's left edge relative to scroller - half scroller width + half button width
        const scrollOffset = selectedButton.offsetLeft - scroller.offsetLeft - (scrollerRect.width / 2) + (selectedRect.width / 2);
        
        setTimeout(() => {
            scroller.scrollTo({ left: scrollOffset, behavior: 'smooth' });
        }, 100);

    }, [selectedDateKey, dates]);


    const getDayLabel = (date: Date) => {
        if (isToday(date)) return "اليوم";
        if (isYesterday(date)) return "الأمس";
        if (isTomorrow(date)) return "غداً";
        return format(date, "EEE", { locale: ar });
    };

    return (
        <div className="bg-card py-1 border-x border-b rounded-b-lg shadow-md -mt-1 h-[52px] flex items-center">
            <ScrollArea className="w-full whitespace-nowrap">
                <div ref={scrollerRef} className="flex w-max space-x-2 px-4 flex-row-reverse">
                    {dates.map((date, index) => {
                        const dateKey = formatDateKey(date);
                        const isSelected = dateKey === selectedDateKey;
                        return (
                            <button
                                key={dateKey}
                                id={`date-button-${dateKey}`}
                                className={cn(
                                    "relative flex flex-col items-center justify-center h-[38px] py-1 px-2 min-w-[38px] rounded-lg transition-colors",
                                    "text-foreground/80 hover:bg-accent/50",
                                    isSelected && "bg-primary text-primary-foreground hover:bg-primary/90"
                                )}
                                onClick={() => onDateSelect(dateKey)}
                            >
                                <span className="text-[9px] font-medium">{getDayLabel(date)}</span>
                                <span className="font-bold text-xs">{format(date, 'd')}</span>
                                <span className="text-[8px] uppercase">{format(date, 'MMM', { locale: ar })}</span>
                            </button>
                        );
                    })}
                </div>
                <ScrollBar orientation="horizontal" className="h-0" />
            </ScrollArea>
        </div>
    );
}

// Main Screen Component
export function MatchesScreen({ navigate, goBack, canGoBack, isVisible, favorites, customNames, setFavorites, onCustomNameChange }: ScreenProps & { isVisible: boolean, setFavorites: React.Dispatch<React.SetStateAction<Partial<Favorites>>>, onCustomNameChange: () => Promise<void> }) {
  const { user } = useAuth();
  const { db, isAdmin } = useAdmin();
  const { toast } = useToast();
  const [showOdds, setShowOdds] = useState(false);
  
  const [selectedDateKey, setSelectedDateKey] = useState<string>(formatDateKey(new Date()));
  
  const [matchesCache, setMatchesCache] = useState<Map<string, FixtureType[]>>(new Map());
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
            const res = await fetch(`https://v3.football.api-sports.io/fixtures?date=${dateKey}`, { 
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
            
            setMatchesCache(prev => new Map(prev).set(dateKey, processedFixtures));

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error(`Failed to fetch data for ${dateKey}:`, error);
                setMatchesCache(prev => new Map(prev).set(dateKey, [])); // Cache empty array on error
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
            const res = await fetch(`https://v3.football.api-sports.io/fixtures?ids=${liveFixtureIds.join('-')}`, { 
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
            
            setMatchesCache(prev => new Map(prev).set(dateKey, newFixtures));

        } catch (error: any) {
            if (error.name !== 'AbortError') console.error("Live update failed:", error);
        }

    }, [matchesCache, getDisplayName]);

  
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

  }, [selectedDateKey, isVisible, customNames, matchesCache, fetchAndProcessData, updateLiveData]);


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
            title="" 
            canGoBack={false}
            onBack={() => {}} 
            actions={
               <div className="flex items-center gap-0.5">
                  <div
                    onClick={() => setShowOdds(prev => !prev)}
                    className={cn("flex items-center justify-center h-8 w-8 rounded-md cursor-pointer", showOdds ? 'bg-accent' : 'hover:bg-accent/50')}
                  >
                    <span className="text-xs font-mono select-none">1x2</span>
                  </div>
                  <SearchSheet navigate={navigate} favorites={favorites} customNames={customNames} setFavorites={setFavorites} onCustomNameChange={onCustomNameChange}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Search className="h-5 w-5" />
                      </Button>
                  </SearchSheet>
                  <ProfileButton />
              </div>
            }
        />
        
        <div className="flex flex-1 flex-col min-h-0">
             <div className="sticky top-0 z-10 px-1 pt-1 bg-background">
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
