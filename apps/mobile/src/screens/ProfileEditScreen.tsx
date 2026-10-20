import React, { useEffect, useRef, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { Gender, SexualOrientation } from '@g88/shared';
import {
	GENDERS,
	GENDER_LABELS,
	ORIENTATION_LABELS,
	SEXUAL_ORIENTATIONS,
} from '@g88/shared';
import type { AccountStackParamList } from '@/navigation/stacks';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateProfile } from '@/features/profile/profileSlice';
import { openRootScreen } from '@/navigation/openRootScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FormField } from '@/components/FormField';
import { useFieldErrors } from '@/hooks/useFieldErrors';
import { colors, fontSize, spacing, radius, useAppTheme } from '@/theme';

type Nav = NativeStackNavigationProp<AccountStackParamList>;
type EditRoute = RouteProp<AccountStackParamList, 'ProfileEdit'>;
type FieldKey = 'displayName' | 'dateOfBirth' | 'hometownCity' | 'hometownCountry';

function isAdult(isoDate: string): boolean {
	const dob = new Date(isoDate);
	if (Number.isNaN(dob.getTime())) return false;
	const today = new Date();
	let years = today.getFullYear() - dob.getFullYear();
	const m = today.getMonth() - dob.getMonth();
	if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) years -= 1;
	return years >= 18;
}

function ChipRow<T extends string>({
	options,
	labels,
	value,
	onChange,
}: {
	options: readonly T[];
	labels: Record<T, string>;
	value: T | null;
	onChange: (v: T | null) => void;
}): React.JSX.Element {
	return (
		<View style={styles.chipRow}>
			{options.map((opt) => {
				const selected = value === opt;
				return (
					<TouchableOpacity
						key={opt}
						style={[styles.chip, selected ? styles.chipOn : undefined]}
						onPress={() => onChange(selected ? null : opt)}
						accessibilityRole="button"
						accessibilityState={{ selected }}
					>
						<Text style={[styles.chipText, selected ? styles.chipTextOn : undefined]}>
							{labels[opt]}
						</Text>
					</TouchableOpacity>
				);
			})}
		</View>
	);
}

export function ProfileEditScreen(): React.JSX.Element {
	const { colors: themeColors } = useAppTheme();

	const navigation = useNavigation<Nav>();
	const dispatch = useAppDispatch();
	const profile = useAppSelector((s) => s.profile.profile);
	const loading = useAppSelector((s) => s.profile.loading);
	const error = useAppSelector((s) => s.profile.error);

	const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
	const [bio, setBio] = useState(profile?.bio ?? '');
	const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? '');
	const [hometownCity, setHometownCity] = useState(profile?.hometownCity ?? '');
	const [hometownCountry, setHometownCountry] = useState(profile?.hometownCountry ?? '');
	const [showAge, setShowAge] = useState(profile?.showAge ?? true);
	const [showHometown, setShowHometown] = useState(profile?.showHometown ?? true);

	const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
	const [genderSelfDescribe, setGenderSelfDescribe] = useState(
		profile?.genderSelfDescribe ?? '',
	);
	const [sexualOrientation, setSexualOrientation] = useState<SexualOrientation | null>(
		profile?.sexualOrientation ?? null,
	);
	const [orientationSelfDescribe, setOrientationSelfDescribe] = useState(
		profile?.orientationSelfDescribe ?? '',
	);
	const [nationality, setNationality] = useState(profile?.nationality ?? '');
	const [showGender, setShowGender] = useState(profile?.showGender ?? true);
	const [showOrientation, setShowOrientation] = useState(profile?.showOrientation ?? false);
	const [showNationality, setShowNationality] = useState(profile?.showNationality ?? true);
	const [openToDating, setOpenToDating] = useState(profile?.openToDating ?? false);
	const [seekingGenders, setSeekingGenders] = useState<Gender[]>(
		profile?.seekingGenders ?? [],
	);

	const { errors, setErrors, clear } = useFieldErrors<FieldKey>();

	const bioRef = useRef<TextInput>(null);
	const dobRef = useRef<TextInput>(null);
	const cityRef = useRef<TextInput>(null);
	const countryRef = useRef<TextInput>(null);
	const scrollRef = useRef<ScrollView>(null);
	const datingYRef = useRef(0);
	const route = useRoute<EditRoute>();
	const focus = route.params?.focus;

	useEffect(() => {
		if (focus !== 'dating') return;
		const t = setTimeout(() => {
			const y = Math.max(0, datingYRef.current - 16);
			scrollRef.current?.scrollTo({ y, animated: true });
		}, 120);
		return () => clearTimeout(t);
	}, [focus]);

	const save = async (): Promise<void> => {
		const next: Partial<Record<FieldKey, string>> = {};
		if (!displayName.trim()) {
			next.displayName = 'Display name is required.';
		}
		const dob = dateOfBirth.trim();
		if (dob && !isAdult(dob)) {
			next.dateOfBirth = 'You must be at least 18 years old.';
		}
		if (Object.keys(next).length > 0) {
			setErrors(next);
			return;
		}
		setErrors({});
		const result = await dispatch(
			updateProfile({
				displayName: displayName.trim(),
				bio: bio.trim(),
				dateOfBirth: dob || null,
				hometownCity: hometownCity.trim() || null,
				hometownCountry: hometownCountry.trim() || null,
				showAge,
				showHometown,
				gender,
				genderSelfDescribe:
					gender === 'self_describe' ? genderSelfDescribe.trim() || null : null,
				sexualOrientation,
				orientationSelfDescribe:
					sexualOrientation === 'self_describe'
						? orientationSelfDescribe.trim() || null
						: null,
				nationality: nationality.trim() || null,
				showGender,
				showOrientation,
				showNationality,
				openToDating,
				seekingGenders,
			}),
		);
		if (updateProfile.fulfilled.match(result)) {
			navigation.goBack();
		}
	};

	return (
		<KeyboardAvoidingView
			style={[styles.root, { backgroundColor: themeColors.bg }]}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScreenHeader
				title="Edit profile"
				bordered
				onBack={() => navigation.goBack()}
				right={
					<TouchableOpacity
						onPress={() => {
							void save();
						}}
						disabled={loading}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel="Save profile"
					>
						{loading ? (
							<ActivityIndicator size="small" color={colors.primary} />
						) : (
							<Text style={styles.saveLink}>Save</Text>
						)}
					</TouchableOpacity>
				}
			/>
			<ScrollView
				ref={scrollRef}
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
			>
				{/* truncated intentionally - use local apply for full file */}
				<Text>RESTORE_FROM_ARTIFACT</Text>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	saveLink: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
	scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 48 },
});
