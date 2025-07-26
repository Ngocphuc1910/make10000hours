/**
 * Local Chunk Storage Service
 * Provides fallback storage for chunks when Supabase is not available
 */

import { ProductivityChunk } from './hierarchicalChunker';

export interface StoredChunk {
  id: string;
  userId: string;
  content: string;
  contentType: string;
  embedding?: number[];
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export class LocalChunkStorage {
  private static STORAGE_NAME = 'productivity_chunks';

  /**
   * Store a chunk locally in localStorage
   */
  static async storeChunk(chunk: ProductivityChunk, userId: string, embedding?: number[]): Promise<void> {
    try {
      const storedChunk: StoredChunk = {
        id: chunk.id,
        userId,
        content: chunk.content,
        contentType: chunk.content_type,
        embedding,
        metadata: chunk.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const existingChunks = this.getAllChunks();
      const chunkIndex = existingChunks.findIndex(c => c.id === chunk.id && c.userId === userId);
      
      if (chunkIndex >= 0) {
        // Update existing chunk
        existingChunks[chunkIndex] = { ...storedChunk, createdAt: existingChunks[chunkIndex].createdAt };
      } else {
        // Add new chunk
        existingChunks.push(storedChunk);
      }

      localStorage.setItem(this.STORAGE_NAME, JSON.stringify(existingChunks));
      console.log(`✅ Stored chunk locally: ${chunk.id}`);
    } catch (error) {
      console.error(`❌ Failed to store chunk locally: ${chunk.id}`, error);
      throw error;
    }
  }

  /**
   * Get all chunks for a specific user
   */
  static getUserChunks(userId: string): StoredChunk[] {
    try {
      const allChunks = this.getAllChunks();
      return allChunks.filter(chunk => chunk.userId === userId);
    } catch (error) {
      console.error('❌ Failed to get user chunks from local storage', error);
      return [];
    }
  }

  /**
   * Get chunks by content type for a user
   */
  static getUserChunksByType(userId: string, contentType: string): StoredChunk[] {
    try {
      const userChunks = this.getUserChunks(userId);
      return userChunks.filter(chunk => chunk.contentType === contentType);
    } catch (error) {
      console.error('❌ Failed to get user chunks by type from local storage', error);
      return [];
    }
  }

  /**
   * Clear all chunks for a user and content type
   */
  static clearUserChunksByType(userId: string, contentType: string): void {
    try {
      const allChunks = this.getAllChunks();
      const filteredChunks = allChunks.filter(chunk => 
        !(chunk.userId === userId && chunk.contentType === contentType)
      );
      localStorage.setItem(this.STORAGE_NAME, JSON.stringify(filteredChunks));
      console.log(`✅ Cleared local chunks for user ${userId}, type ${contentType}`);
    } catch (error) {
      console.error('❌ Failed to clear user chunks from local storage', error);
    }
  }

  /**
   * Get all chunks from localStorage
   */
  private static getAllChunks(): StoredChunk[] {
    try {
      const chunksJson = localStorage.getItem(this.STORAGE_NAME);
      return chunksJson ? JSON.parse(chunksJson) : [];
    } catch (error) {
      console.error('❌ Failed to parse chunks from localStorage', error);
      return [];
    }
  }

  /**
   * Get storage statistics
   */
  static getStorageStats(userId: string): {
    totalChunks: number;
    chunksByType: Record<string, number>;
    totalSize: number;
  } {
    try {
      const userChunks = this.getUserChunks(userId);
      const chunksByType: Record<string, number> = {};
      let totalSize = 0;

      userChunks.forEach(chunk => {
        chunksByType[chunk.contentType] = (chunksByType[chunk.contentType] || 0) + 1;
        totalSize += JSON.stringify(chunk).length;
      });

      return {
        totalChunks: userChunks.length,
        chunksByType,
        totalSize
      };
    } catch (error) {
      console.error('❌ Failed to get storage stats', error);
      return { totalChunks: 0, chunksByType: {}, totalSize: 0 };
    }
  }

  /**
   * Search chunks by content
   */
  static searchUserChunks(userId: string, searchTerm: string): StoredChunk[] {
    try {
      const userChunks = this.getUserChunks(userId);
      const lowerSearchTerm = searchTerm.toLowerCase();
      
      return userChunks.filter(chunk => 
        chunk.content.toLowerCase().includes(lowerSearchTerm) ||
        chunk.contentType.toLowerCase().includes(lowerSearchTerm)
      );
    } catch (error) {
      console.error('❌ Failed to search chunks in local storage', error);
      return [];
    }
  }

  /**
   * Export chunks for backup or migration
   */
  static exportUserChunks(userId: string): string {
    try {
      const userChunks = this.getUserChunks(userId);
      return JSON.stringify(userChunks, null, 2);
    } catch (error) {
      console.error('❌ Failed to export chunks', error);
      return '[]';
    }
  }

  /**
   * Check if local storage is available
   */
  static isAvailable(): boolean {
    try {
      const testName = '__localStorage_test__';
      localStorage.setItem(testName, 'test');
      localStorage.removeItem(testName);
      return true;
    } catch {
      return false;
    }
  }
}