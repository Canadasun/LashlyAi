import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

// Apple guidelines 5.1.1(i)/5.1.2(i): before sending personal data (a client photo) to a
// third-party AI service, the app must disclose what is sent and who it's sent to, and
// obtain the user's permission. Every screen that uploads a photo for AI processing
// (Eye Analysis, Photo Feedback, AI Retouch, AR Lash Preview) renders this same
// component so the disclosure is consistent and none of them can drift back to a vague
// "consented to this" checkbox that doesn't name the third party or the data.
export function AiConsentCheckbox({
  checked,
  onToggle,
  purpose,
}: {
  checked: boolean;
  onToggle: () => void;
  purpose: string;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkboxMark}>✓</Text>}
      </View>
      <Text style={styles.text}>
        This photo will be sent to OpenAI, a third-party AI service, to {purpose}. The client
        has consented to this photo being shared with OpenAI for this purpose.
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  checkboxMark: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  text: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 17 },
});
