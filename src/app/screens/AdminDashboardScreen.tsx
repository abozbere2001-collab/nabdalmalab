

"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdmin, useFirestore } from '@/firebase';
import { collection, getDocs, doc, getDoc, collectionGroup, query } from 'firebase/firestore';
import { Loader2, Users, Trophy, ThumbsUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Stat {
  name: string;
  count: number;
}

const SimpleBarChart = ({ data, title }: { data: Stat[], title: string }) => {
    if (data.length === 0) {
        return (
            <Card>
                <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground text-center p-4">لا توجد بيانات لعرضها.</p></CardContent>
            </Card>
        );
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" name="عدد المتابعين" fill="hsl(var(--primary))" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

export function AdminDashboardScreen({ navigate, goBack, canGoBack }: ScreenProps) {
    const { isAdmin, isCheckingAdmin } = useAdmin();
    const { db } = useFirestore();
    
    const [totalUsers, setTotalUsers] = useState(0);
    const [totalPredictions, setTotalPredictions] = useState(0);
    const [teamFollows, setTeamFollows] = useState<Stat[]>([]);
    const [leagueFollows, setLeagueFollows] = useState<Stat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isAdmin || !db) {
            if (!isCheckingAdmin) setLoading(false);
            return;
        }

        const fetchStats = async () => {
            setLoading(true);
            try {
                // 1. Get total users
                const usersSnapshot = await getDocs(collection(db, 'users'));
                setTotalUsers(usersSnapshot.size);

                // 2. Aggregate favorites
                const teamCounts: { [key: string]: number } = {};
                const leagueCounts: { [key: string]: number } = {};

                for (const userDoc of usersSnapshot.docs) {
                    const favoritesDocRef = doc(db, 'users', userDoc.id, 'favorites', 'data');
                    const favoritesSnapshot = await getDoc(favoritesDocRef);
                    
                    if (favoritesSnapshot.exists()) {
                        const favoritesData = favoritesSnapshot.data();
                        if (favoritesData.teams) {
                            Object.values(favoritesData.teams).forEach((team: any) => {
                                teamCounts[team.name] = (teamCounts[team.name] || 0) + 1;
                            });
                        }
                        if (favoritesData.leagues) {
                            Object.values(favoritesData.leagues).forEach((league: any) => {
                                leagueCounts[league.name] = (leagueCounts[league.name] || 0) + 1;
                            });
                        }
                    }
                }
                
                // 3. Aggregate total predictions from subcollections
                const predictionsQuery = query(collectionGroup(db, 'userPredictions'));
                const predictionsSnapshot = await getDocs(predictionsQuery);
                setTotalPredictions(predictionsSnapshot.size);


                const toSortedStats = (counts: { [key: string]: number }) => Object.entries(counts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count);

                setTeamFollows(toSortedStats(teamCounts));
                setLeagueFollows(toSortedStats(leagueCounts));

            } catch (error) {
                console.error("Failed to fetch admin stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [isAdmin, isCheckingAdmin, db]);

    if (loading || isCheckingAdmin) {
        return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="لوحة التحكم" onBack={goBack} canGoBack={true} />
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </div>
        );
    }
    
    if (!isAdmin) {
         return (
            <div className="flex h-full flex-col bg-background">
                <ScreenHeader title="لوحة التحكم" onBack={goBack} canGoBack={true} />
                <div className="flex flex-1 items-center justify-center p-4 text-center">
                    <p className="text-destructive">ليس لديك الصلاحية للوصول إلى هذه الصفحة.</p>
                </div>
            </div>
        );
    }


    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="لوحة التحكم" onBack={goBack} canGoBack={true} />
            <ScrollArea className="flex-1">
                <div className="p-4 grid grid-cols-2 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">إجمالي المستخدمين</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalUsers}</div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">إجمالي التوقعات</CardTitle>
                            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalPredictions}</div>
                        </CardContent>
                    </Card>

                    <div className="col-span-2">
                        <SimpleBarChart data={teamFollows.slice(0, 15)} title="أكثر 15 فريقًا متابعةً" />
                    </div>
                     <div className="col-span-2">
                        <SimpleBarChart data={leagueFollows.slice(0, 15)} title="أكثر 15 بطولة متابعةً" />
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
