import { nexaBrand, nexaDark, nexaStatus } from './brand';

export type ThemeColors = {
  canvas: string; mapBase: string; surfacePrimary: string; surfaceSecondary: string; surfaceTertiary: string; surfaceHover: string; borderSubtle: string; borderDefault: string; borderStrong: string;
  bg: string; surface: string; surfaceRaised: string; surfaceAlt: string; border: string;
  brandViolet: string; brandVioletBright: string; brandVioletMuted: string; brandCyan: string; brandCyanBright: string; brandCyanMuted: string; actionPrimary: string; discovery: string; live: string; verified: string; onPrimary: string;
  primary: string; accent: string; info: string; action: string;
  textPrimary: string; textSecondary: string; textTertiary: string; textDisabled: string; textInverse: string; textMuted: string; textFaint: string;
  danger: string; dangerMuted: string; dangerSurface: string; dangerBorder: string; dangerSolid: string; primaryTrack: string; warning: string; success: string;
  entityPerson: string; entityEvent: string; entityListing: string; entityOpportunity: string; entityUser: string; entityFriend: string; entityWanted: string;
  premium: string; premiumBorder: string; premiumTier: string;
  toastXp: string; toastSuccess: string; toastAchievement: string; toastRank: string; toastWave: string; toastGift: string;
  shadowInk: string;
  actionSoft: string; actionMutedBg: string; actionGhost: string; actionBorderSoft: string; actionBorder: string;
  discoverySoft: string; discoveryMutedBg: string; discoveryGhost: string; discoveryBorderSoft: string; discoveryBorder: string;
  primarySoft: string; primaryMutedBg: string; primaryGhost: string; primaryBorderSoft: string; primaryBorder: string;
  premiumSoft: string; premiumMutedBg: string; premiumBorderSoft: string; premiumBorderMid: string; dangerBorderSoft: string;
};

export const darkColors: ThemeColors = {
  canvas:nexaDark.canvas,mapBase:nexaDark.mapBase,surfacePrimary:nexaDark.surfacePrimary,surfaceSecondary:nexaDark.surfaceSecondary,surfaceTertiary:nexaDark.surfaceTertiary,surfaceHover:nexaDark.surfaceHover,borderSubtle:nexaDark.borderSubtle,borderDefault:nexaDark.borderDefault,borderStrong:nexaDark.borderStrong,
  bg:nexaDark.canvas,surface:nexaDark.surfacePrimary,surfaceRaised:nexaDark.surfaceSecondary,surfaceAlt:nexaDark.surfaceTertiary,border:nexaDark.borderSubtle,
  brandViolet:nexaBrand.violet,brandVioletBright:nexaBrand.violetBright,brandVioletMuted:nexaBrand.violetMuted,brandCyan:nexaBrand.cyan,brandCyanBright:nexaBrand.cyanBright,brandCyanMuted:nexaBrand.cyanMuted,actionPrimary:nexaBrand.violet,discovery:nexaBrand.cyan,live:nexaBrand.cyan,verified:nexaBrand.cyan,onPrimary:nexaDark.textPrimary,
  primary:nexaBrand.violet,accent:nexaBrand.cyan,info:nexaBrand.cyan,action:nexaBrand.violet,
  textPrimary:nexaDark.textPrimary,textSecondary:nexaDark.textSecondary,textTertiary:nexaDark.textTertiary,textDisabled:nexaDark.textDisabled,textInverse:nexaDark.textInverse,textMuted:nexaDark.textTertiary,textFaint:nexaDark.textDisabled,
  danger:nexaStatus.error,dangerMuted:'#FF8295',dangerSurface:'rgba(255,100,124,.10)',dangerBorder:'rgba(255,100,124,.28)',dangerSolid:'#D84C65',primaryTrack:nexaBrand.violetMuted,warning:nexaStatus.warning,success:nexaStatus.success,
  entityPerson:nexaBrand.violet,entityEvent:nexaBrand.cyan,entityListing:nexaDark.textPrimary,entityOpportunity:nexaBrand.violet,entityUser:nexaBrand.violet,entityFriend:nexaBrand.cyanBright,entityWanted:nexaBrand.violetBright,
  premium:'#FFD166',premiumBorder:'rgba(255,209,102,.32)',premiumTier:nexaBrand.violetBright,
  toastXp:'#241C0E',toastSuccess:'#0D241A',toastAchievement:'#1A1530',toastRank:'#0C2028',toastWave:'#0B2229',toastGift:'#21142C',shadowInk:'#000000',
  actionSoft:'rgba(124,92,252,.07)',actionMutedBg:'rgba(124,92,252,.10)',actionGhost:'rgba(124,92,252,.14)',actionBorderSoft:'rgba(124,92,252,.25)',actionBorder:'rgba(124,92,252,.40)',
  discoverySoft:'rgba(39,211,242,.07)',discoveryMutedBg:'rgba(39,211,242,.10)',discoveryGhost:'rgba(39,211,242,.14)',discoveryBorderSoft:'rgba(39,211,242,.24)',discoveryBorder:'rgba(39,211,242,.38)',
  primarySoft:'rgba(124,92,252,.07)',primaryMutedBg:'rgba(124,92,252,.10)',primaryGhost:'rgba(124,92,252,.14)',primaryBorderSoft:'rgba(124,92,252,.25)',primaryBorder:'rgba(124,92,252,.40)',premiumSoft:'rgba(255,209,102,.07)',premiumMutedBg:'rgba(255,209,102,.10)',premiumBorderSoft:'rgba(255,209,102,.20)',premiumBorderMid:'rgba(255,209,102,.40)',dangerBorderSoft:'rgba(255,100,124,.40)'
};

export const lightColors: ThemeColors = {
  ...darkColors, canvas:'#F6F7FA',mapBase:'#EEF1F5',surfacePrimary:'#FFFFFF',surfaceSecondary:'#F0F2F7',surfaceTertiary:'#E7EAF0',surfaceHover:'#DFE3EA',borderSubtle:'rgba(9,10,14,.08)',borderDefault:'rgba(9,10,14,.13)',borderStrong:'rgba(9,10,14,.22)',bg:'#F6F7FA',surface:'#FFFFFF',surfaceRaised:'#F0F2F7',surfaceAlt:'#E7EAF0',border:'rgba(9,10,14,.08)',actionPrimary:'#6849DF',onPrimary:'#FFFFFF',primary:'#6849DF',action:'#6849DF',textPrimary:'#111318',textSecondary:'#4B515D',textTertiary:'#6E7582',textDisabled:'#9AA0AB',textInverse:nexaDark.textPrimary,textMuted:'#6E7582',textFaint:'#9AA0AB',danger:'#C93650',dangerMuted:'#B52E46',dangerSurface:'#FFF0F3',dangerBorder:'#F2BEC8',dangerSolid:'#AE2B42',primaryTrack:'#9A87ED',warning:'#8A6500',success:'#147A4D',entityListing:'#20242B',premium:'#9A7412',premiumBorder:'rgba(154,116,18,.30)',premiumTier:'#6E52E8',shadowInk:'#000000'
};

/** Premium-only postmodern neon appearance. Pink is identity; violet/cyan keep NEXA semantics. */
export const protosNexusColors: ThemeColors = {
  ...darkColors,
  canvas:'#07050B',mapBase:'#0B0811',surfacePrimary:'#100B17',surfaceSecondary:'#171020',surfaceTertiary:'#20142A',surfaceHover:'#291733',
  borderSubtle:'rgba(255,61,172,.12)',borderDefault:'rgba(255,61,172,.22)',borderStrong:'rgba(255,61,172,.42)',
  bg:'#07050B',surface:'#100B17',surfaceRaised:'#171020',surfaceAlt:'#20142A',border:'rgba(255,61,172,.18)',
  brandViolet:'#A970FF',brandVioletBright:'#C69BFF',brandVioletMuted:'#8056B8',brandCyan:'#3DE7FF',brandCyanBright:'#83F1FF',brandCyanMuted:'#26A9BC',
  actionPrimary:'#FF3DAC',discovery:'#3DE7FF',live:'#3DE7FF',verified:'#3DE7FF',onPrimary:'#FFFFFF',primary:'#FF3DAC',accent:'#3DE7FF',info:'#3DE7FF',action:'#FF3DAC',
  textPrimary:'#FFF7FC',textSecondary:'#D9C8D5',textTertiary:'#A98FA3',textDisabled:'#725E6D',textInverse:'#120810',textMuted:'#A98FA3',textFaint:'#725E6D',
  primaryTrack:'#B51C78',entityPerson:'#FF3DAC',entityUser:'#FF3DAC',entityFriend:'#3DE7FF',entityWanted:'#C69BFF',entityOpportunity:'#A970FF',
  premium:'#FF3DAC',premiumBorder:'rgba(255,61,172,.55)',premiumTier:'#FF75C4',
  shadowInk:'#FF3DAC',actionSoft:'rgba(255,61,172,.08)',actionMutedBg:'rgba(255,61,172,.12)',actionGhost:'rgba(255,61,172,.17)',actionBorderSoft:'rgba(255,61,172,.28)',actionBorder:'rgba(255,61,172,.52)',
  primarySoft:'rgba(255,61,172,.08)',primaryMutedBg:'rgba(255,61,172,.12)',primaryGhost:'rgba(255,61,172,.17)',primaryBorderSoft:'rgba(255,61,172,.28)',primaryBorder:'rgba(255,61,172,.52)',premiumSoft:'rgba(255,61,172,.08)',premiumMutedBg:'rgba(255,61,172,.12)',premiumBorderSoft:'rgba(255,61,172,.28)',premiumBorderMid:'rgba(255,61,172,.52)'
};
