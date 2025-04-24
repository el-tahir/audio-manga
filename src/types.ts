export type ClassificationResult = {
  filename: string;
  category: 'intro' | 'love' | 'love_ran' | 'casual' | 'adventure' | 'comedy' | 'action_casual' | 'action_serious' | 'tragic' | 'tension' | 'confrontation' | 'investigation' | 'revelation' | 'conclusion';
  explanation?: string;
};
