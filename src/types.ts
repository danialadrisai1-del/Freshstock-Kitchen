export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  category: string;
  addedAt: string;
  expiresAt: string;
  imageUrl?: string | null;
  status: 'fresh' | 'expiring' | 'expired';
}
