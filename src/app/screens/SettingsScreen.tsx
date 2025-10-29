

"use client";

import { useEffect, useState } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { ChevronLeft, LogOut, User, Search, Trophy, Settings as SettingsIcon, FileText, FileBadge } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { useToast } from '@/hooks/use-toast';
import { signOut as firebaseSignOut } from '@/lib/firebase-client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';

export function SettingsScreen({ navigate, goBack, canGoBack, favorites, customNames, setFavorites }: ScreenProps & {setFavorites: (favorites: any) => void}) {
  const { toast } = useToast();
  
  const mainSettingsItems = [
      { label: "الملف الشخصي", icon: User, action: (navigate: ScreenProps['navigate']) => navigate('Profile') },
      { label: "كل البطولات", icon: Trophy, action: (navigate: ScreenProps['navigate']) => navigate('AllCompetitions') },
      { label: "الإعدادات العامة", icon: SettingsIcon, action: (navigate: ScreenProps['navigate']) => navigate('GeneralSettings')},
  ];

  const legalSettingsItems = [
      { label: "سياسة الخصوصية", icon: FileBadge, action: (navigate: ScreenProps['navigate']) => navigate('PrivacyPolicy') },
      { label: "شروط الخدمة", icon: FileText, action: (navigate: ScreenProps['navigate']) => navigate('TermsOfService') },
  ];

  const handleSignOut = async () => {
    try {
      await firebaseSignOut();
      toast({
        title: "تم تسجيل الخروج",
        description: "نأمل رؤيتك مرة أخرى قريبا.",
      });
      // The onAuthStateChanged listener in Home will handle navigation
    } catch (error) {
       toast({
        variant: 'destructive',
        title: "فشل تسجيل الخروج",
        description: "حدث خطأ أثناء تسجيل الخروج. يرجى المحاولة مرة أخرى.",
      });
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader 
        title={"المزيد"} 
        onBack={goBack} 
        canGoBack={canGoBack} 
        actions={
          <div className="flex items-center gap-1">
              <SearchSheet navigate={navigate} favorites={favorites} customNames={customNames} setFavorites={setFavorites}>
                  <Button variant="ghost" size="icon">
                      <Search className="h-5 w-5" />
                  </Button>
              </SearchSheet>
              <ProfileButton/>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        
        <div className="space-y-2">
            {mainSettingsItems.map(item => (
                <button key={item.label} onClick={() => item.action(navigate)} className="flex w-full items-center justify-between rounded-lg bg-card p-4 text-right transition-colors hover:bg-accent/50">
                    <div className="flex items-center gap-4">
                        <item.icon className="h-6 w-6 text-primary"/>
                        <span className="font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <ChevronLeft className="h-5 w-5"/>
                    </div>
                </button>
            ))}
        </div>

        <div className="pt-4">
            <p className="px-4 pb-2 text-sm font-semibold text-muted-foreground">قانوني</p>
            <div className="space-y-2">
                {legalSettingsItems.map(item => (
                    <button key={item.label} onClick={() => item.action(navigate)} className="flex w-full items-center justify-between rounded-lg bg-card p-4 text-right transition-colors hover:bg-accent/50">
                        <div className="flex items-center gap-4">
                            <item.icon className="h-6 w-6 text-muted-foreground"/>
                            <span className="font-medium">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <ChevronLeft className="h-5 w-5"/>
                        </div>
                    </button>
                ))}
            </div>
        </div>


        <div className="pt-8">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full gap-2">
                  <LogOut className="h-5 w-5" />
                  تسجيل الخروج
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيؤدي هذا الإجراء إلى تسجيل خروجك من حسابك.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut}>متابعة</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </div>
    </div>
  );
}
