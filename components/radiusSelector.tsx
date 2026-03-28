import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { Colors } from '../constants/theme';
import type { ThemeName } from '../types/index';
import { DISTANCE_UNIT, RADIUS_OPTIONS } from '../utils/constants';

type RadiusSelectorProps = {
	value: number;
	onChange: (value: number) => void;
	theme: ThemeName;
};

export const RadiusSelector = ({ value, onChange, theme }: RadiusSelectorProps) => {
	const [isPickerVisible, setPickerVisible] = useState(false);
	const [dropdownTop, setDropdownTop] = useState(0);
	const [dropdownLeft, setDropdownLeft] = useState(0);
	const [dropdownWidth, setDropdownWidth] = useState(0);
	const buttonRef = useRef<View>(null);
	const palette = Colors[theme];

	const handleSelect = useCallback(
		(next: number) => {
			onChange(next);
			setPickerVisible(false);
		},
		[onChange]
	);

	const handleOpen = useCallback(() => {
		buttonRef.current?.measureInWindow((x, y, width, height) => {
			setDropdownTop(y + height + 6);
			setDropdownLeft(x);
			setDropdownWidth(width);
			setPickerVisible(true);
		});
	}, []);

	const unitLabel = DISTANCE_UNIT === 'miles' ? 'mi' : DISTANCE_UNIT;
	const currentLabel = `Location: ${value} ${unitLabel}`;

	return (
		<View ref={buttonRef} style={styles.radiusPickerContainer}>
			<TouchableOpacity
				style={[styles.radiusPickerButton, { borderColor: palette.border, backgroundColor: palette.background }]}
				onPress={isPickerVisible ? () => setPickerVisible(false) : handleOpen}
				activeOpacity={0.85}
				accessibilityLabel={`Search radius: ${value} ${unitLabel}. Tap to change.`}
				accessibilityRole="button"
			>
				<Text style={[styles.radiusPickerValue, { color: palette.cardTitle }]}>{currentLabel}</Text>
				<MaterialIcons name={isPickerVisible ? 'arrow-drop-up' : 'arrow-drop-down'} size={22} color={palette.cardTitle} />
			</TouchableOpacity>

			<Modal visible={isPickerVisible} transparent animationType="none" onRequestClose={() => setPickerVisible(false)}>
				<Pressable style={styles.radiusModalBackdrop} onPress={() => setPickerVisible(false)}>
					<View
						style={[
							styles.radiusPickerDropdown,
							{ top: dropdownTop, left: dropdownLeft, width: dropdownWidth, backgroundColor: palette.container, borderColor: palette.border },
						]}
					>
						{RADIUS_OPTIONS.map((option) => (
							<TouchableOpacity
								key={option}
								style={styles.radiusPickerOption}
								onPress={() => handleSelect(option)}
								accessibilityLabel={`${option} ${unitLabel}`}
								accessibilityRole="button"
							>
								<Text style={[styles.radiusPickerOptionText, { color: option === value ? palette.cardTitle : palette.cardSubtitle }]}>
									{option} {unitLabel}
								</Text>
							</TouchableOpacity>
						))}
					</View>
				</Pressable>
			</Modal>
		</View>
	);
};

const styles = StyleSheet.create({
	radiusPickerContainer: {
		position: 'relative',
		alignSelf: 'flex-start',
		zIndex: 20,
		elevation: 20,
	},
	radiusPickerButton: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 10,
		minWidth: 160,
		gap: 10,
	},
	radiusPickerValue: {
		fontSize: 15,
		fontWeight: '700',
	},
	radiusModalBackdrop: {
		flex: 1,
	},
	radiusPickerDropdown: {
		position: 'absolute',
		borderRadius: 12,
		borderWidth: 1,
		paddingVertical: 6,
		shadowColor: '#000',
		shadowOpacity: 0.18,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 6 },
		elevation: 22,
	},
	radiusPickerOption: {
		paddingVertical: 12,
		paddingHorizontal: 16,
	},
	radiusPickerOptionText: {
		fontSize: 15,
		fontWeight: '700',
	},
});
