export type ClassificationResult = {
  filename: string;
  category: 'investigation' | 'suspense' | 'action' | 'revelation' | 'conclusion' | 'casual' | 'tragic';
  confidence?: number;
  explanation?: string;
};
