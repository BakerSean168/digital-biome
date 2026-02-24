export interface Note {
  id: string;
  slug: string;
  title: string;
  description?: string;
  content: string;
  tags: string[];
  url?: string;
  draft: boolean;
  private: boolean;
  category?: string;
  aliases: string[];
  type: 'note' | 'resource' | 'tool' | 'article';
  created?: Date;
  updated?: Date;
  icon?: string;
  rating?: number;
  platform?: string;
  pricing?: 'free' | 'freemium' | 'paid' | 'subscription';
  status?: 'active' | 'archived' | 'deprecated';
  lastModified?: Date;
  isBookmark: boolean;
  categories: string[];
}

export interface Bookmark {
  title: string;
  url: string;
  description?: string;
  categories: string[];
  icon?: string;
  slug: string;
}

export interface Category {
  name: string;
  slug: string;
  count: number;
}

export interface WikiLink {
  target: string;
  displayText: string;
  exists: boolean;
}

export interface NoteCollectionEntry {
  id: string;
  slug: string;
  body: string;
  collection: string;
  data: {
    title: string;
    description?: string;
    tags?: string[];
    url?: string;
    draft?: boolean;
    private?: boolean;
    category?: string;
    aliases?: string[];
    type?: 'note' | 'resource' | 'tool' | 'article';
    created?: Date;
    updated?: Date;
    icon?: string;
    rating?: number;
    platform?: string;
    pricing?: 'free' | 'freemium' | 'paid' | 'subscription';
    status?: 'active' | 'archived' | 'deprecated';
  };
}
