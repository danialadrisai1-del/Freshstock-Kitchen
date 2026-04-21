export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  category: string;
  addedAt: string;
  expiresAt: string;
  imageUrl?: string;
  status: 'fresh' | 'expiring' | 'expired';
}
