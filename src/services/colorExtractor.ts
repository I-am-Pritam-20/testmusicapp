import { Platform } from 'react-native';

let ImagePalette: any = null;
let paletteAvailable = false;
try {
  ImagePalette = require('@somesoap/react-native-image-palette');
  paletteAvailable = true;
} catch {
  paletteAvailable = false;
}

class ColorExtractor {
  private cache = new Map<string, string>();
  private maxCacheSize = 150;
  private useNativeExtraction = paletteAvailable;

  async getDominantColor(imageUrl: string): Promise<string> {
    if (!imageUrl) return '#1a1a1a';
    if (this.cache.has(imageUrl)) return this.cache.get(imageUrl)!;
    try {
      let color: string;
      if (this.useNativeExtraction && ImagePalette) {
        try {
          color = await this.extractNative(imageUrl);
        } catch {
          color = this.extractFallback(imageUrl);
        }
      } else {
        color = this.extractFallback(imageUrl);
      }
      this.addToCache(imageUrl, color);
      return color;
    } catch {
      return this.generateFallback(imageUrl);
    }
  }

  /**
   * Synchronous, deterministic fallback color for a given seed (typically
   * a track id) — used as an instant placeholder wherever a color is
   * needed before/without the async native-or-fallback extraction above
   * (see trackMapper.songToTrack, which needs a bgColor synchronously).
   */
  getFallbackColorSync(seed: string): string {
    return this.generateFallback(seed);
  }

  private async extractNative(imageUrl: string): Promise<string> {
    const palette = await ImagePalette.getPalette(imageUrl, { fallbackColor: '#1a1a1a' });
    let color: string | null = null;
    for (const key of ['muted', 'darkMuted', 'lightMuted', 'darkVibrant', 'lightVibrant', 'vibrant']) {
      if (palette[key] && palette[key] !== '#fff') { color = palette[key]; break; }
    }
    if (!color && Platform.OS === 'android' && palette.dominantAndroid) color = palette.dominantAndroid;
    if (!color) color = await ImagePalette.getAverageColor(imageUrl, { fallbackColor: '#1a1a1a' });
    return this.adjustForUI(color || '#1a1a1a');
  }

  private extractFallback(imageUrl: string): string {
    return this.generateFallback(imageUrl);
  }

  private generateFallback(input: string): string {
    const colors = [
      '#FF6B6B','#FF8E53','#FF6B9D','#C44569','#F8B500','#FFD93D',
      '#4ECDC4','#45B7D1','#6C5CE7','#A29BFE','#74B9FF','#00CEC9',
      '#96CEB4','#26DE81','#2ECC71','#F39C12','#E17055','#1DB954',
      '#FF1744','#9C27B0','#FF9800','#00BCD4','#4CAF50','#E91E63',
    ];
    const hash = this.hash(input || 'default');
    const base = colors[Math.abs(hash) % colors.length];
    const v = (hash % 60) - 30;
    const rgb = this.hexToRgb(base);
    return this.adjustForUI({
      r: Math.max(20, Math.min(235, rgb.r + v)),
      g: Math.max(20, Math.min(235, rgb.g + v)),
      b: Math.max(20, Math.min(235, rgb.b + v)),
    });
  }

  private adjustForUI(color: string | { r: number; g: number; b: number }): string {
    const { r, g, b } = typeof color === 'string' ? this.hexToRgb(color) : color;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (lum > 0.75) return this.toHex(Math.max(30, r - 70), Math.max(30, g - 70), Math.max(30, b - 70));
    if (lum < 0.2)  return this.toHex(Math.min(225, r + 50), Math.min(225, g + 50), Math.min(225, b + 50));
    return this.toHex(r, g, b);
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16) || 26;
    const g = parseInt(h.substr(2, 2), 16) || 26;
    const b = parseInt(h.substr(4, 2), 16) || 26;
    return { r, g, b };
  }

  private toHex(r: number, g: number, b: number): string {
    const h = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
  }

  private hash(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h = h & h;
    }
    return h;
  }

  private addToCache(key: string, value: string) {
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
}

export const colorExtractor = new ColorExtractor();