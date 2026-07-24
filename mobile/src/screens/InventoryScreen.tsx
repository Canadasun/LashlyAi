import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { InventoryCategory, InventoryItem } from '../types/api';
import { useDeviceClass } from '../hooks/useDeviceClass';

const CATEGORIES: InventoryCategory[] = ['lash_trays', 'glue', 'tools', 'other'];

type Props = NativeStackScreenProps<RootStackParamList, 'Inventory'>;

export function InventoryScreen({ navigation }: Props) {
  const { isTablet } = useDeviceClass();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Inventory tracking is Salon-only — a 403 here means the gate, not a real
  // failure, so it gets a distinct "Upgrade to Salon" state instead of the generic
  // error text.
  const [locked, setLocked] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('glue');
  const [quantity, setQuantity] = useState('');
  const [threshold, setThreshold] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const load = useCallback(async () => {
    try {
      setError(null);
      setLocked(false);
      const result = await api.get<InventoryItem[]>('/inventory');
      setItems(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setLocked(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load inventory');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const addItem = async () => {
    if (!name.trim()) {
      setError('Item name is required');
      return;
    }
    try {
      await api.post('/inventory', {
        name: name.trim(),
        category,
        quantity: Number(quantity) || 0,
        low_stock_threshold: Number(threshold) || 0,
        expiry_date: expiryDate.trim() || undefined,
      });
      setName('');
      setQuantity('');
      setThreshold('');
      setExpiryDate('');
      setShowAddForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    }
  };

  const adjustQuantity = async (item: InventoryItem, delta: number) => {
    const newQuantity = Math.max(0, Number(item.quantity) + delta);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, quantity: newQuantity } : i)),
    );
    try {
      await api.patch<InventoryItem>(`/inventory/${item.id}`, { quantity: newQuantity });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update quantity');
      load();
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : locked ? (
        <View style={styles.lockedContainer}>
          <Text style={styles.lockedTitle}>Inventory tracking is a Salon feature</Text>
          <Text style={styles.lockedText}>
            Track lash trays, glue, and tools with low-stock and expiry alerts on Salon.
          </Text>
          <TouchableOpacity style={styles.upgradeButton} onPress={() => navigation.navigate('Paywall')}>
            <Text style={styles.upgradeButtonText}>Upgrade to Salon</Text>
          </TouchableOpacity>
        </View>
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, isTablet && styles.listTablet]}
          ListEmptyComponent={<Text style={styles.empty}>No inventory items yet.</Text>}
          renderItem={({ item }) => (
            <View
              style={[
                styles.row,
                (item.is_low_stock || item.is_expired || item.is_expiring_soon) && styles.rowLow,
              ]}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.category.replace('_', ' ')} · {item.quantity} {item.unit}
                  {item.is_low_stock ? ' · LOW STOCK' : ''}
                  {item.is_expired ? ' · EXPIRED' : item.is_expiring_soon ? ' · EXPIRING SOON' : ''}
                </Text>
                {item.expiry_date && (
                  <Text style={styles.rowMeta}>Expires {item.expiry_date}</Text>
                )}
              </View>
              <View style={styles.rowActions}>
                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => adjustQuantity(item, -1)}>
                  <Text style={styles.stepButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => adjustQuantity(item, 1)}>
                  <Text style={styles.stepButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {showAddForm && (
        <View style={[styles.addForm, isTablet && styles.addFormTablet]}>
          <TextInput
            style={styles.input}
            placeholder="Item name"
            value={name}
            onChangeText={setName}
          />
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipSelected]}
                onPress={() => setCategory(c)}>
                <Text style={[styles.chipText, category === c && styles.chipTextSelected]}>
                  {c.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Starting quantity"
            keyboardType="number-pad"
            value={quantity}
            onChangeText={setQuantity}
          />
          <TextInput
            style={styles.input}
            placeholder="Low stock threshold"
            keyboardType="number-pad"
            value={threshold}
            onChangeText={setThreshold}
          />
          <TextInput
            style={styles.input}
            placeholder="Expiry date (YYYY-MM-DD, optional)"
            value={expiryDate}
            onChangeText={setExpiryDate}
          />
          <TouchableOpacity style={styles.saveButton} onPress={addItem}>
            <Text style={styles.saveButtonText}>Save Item</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddForm((v) => !v)}>
        <Text style={styles.fabText}>{showAddForm ? 'Cancel' : '+ Add Item'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 40 },
  error: { color: '#B3261E', textAlign: 'center', marginTop: 24 },
  lockedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  lockedTitle: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' },
  lockedText: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 19,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  upgradeButtonText: { color: colors.background, fontWeight: '700', fontSize: 14 },
  empty: { color: colors.text, textAlign: 'center', marginTop: 40, opacity: 0.6 },
  list: { padding: 16 },
  listTablet: { maxWidth: 700, width: '100%', alignSelf: 'center' },
  row: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLow: { borderWidth: 1, borderColor: '#B3261E' },
  rowInfo: { flex: 1 },
  rowName: { color: colors.text, fontWeight: '600' },
  rowMeta: { color: colors.accent, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  rowActions: { flexDirection: 'row' },
  stepButton: {
    backgroundColor: colors.background,
    borderRadius: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  stepButtonText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  addForm: { backgroundColor: '#ffffff', padding: 16, borderTopWidth: 1, borderTopColor: '#eee' },
  addFormTablet: { maxWidth: 460, width: '100%', alignSelf: 'center' },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 14,
    color: colors.text,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { backgroundColor: colors.background, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { fontSize: 11, color: colors.text, fontWeight: '600', textTransform: 'capitalize' },
  chipTextSelected: { color: colors.background },
  saveButton: { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: colors.background, fontWeight: '700' },
  fab: {
    backgroundColor: colors.primary,
    margin: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  fabText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
