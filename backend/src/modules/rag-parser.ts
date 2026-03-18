/**
 * Document Parser Module
 * Supports PDF, DOCX, TXT, and Markdown parsing
 */

import { createLogger } from '@ai-interview/shared';

const logger = createLogger('DocumentParser');

export interface ParsedDocument {
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'markdown';
  content: string;
  metadata: {
    wordCount: number;
    charCount: number;
    paragraphs: number;
    headings?: string[];
    [key: string]: any;
  };
}

/**
 * Document Parser - Handles multiple file formats
 */
export class DocumentParser {
  /**
   * Parse a File object to text content
   */
  async parseFile(file: File): Promise<ParsedDocument> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    logger.info(`Parsing file: ${file.name} (${extension})`);

    switch (extension) {
      case 'txt':
        return this.parseText(file);
      case 'md':
      case 'markdown':
        return this.parseMarkdown(file);
      case 'pdf':
        return this.parsePDF(file);
      case 'docx':
        return this.parseDOCX(file);
      default:
        throw new Error(`Unsupported file type: ${extension}`);
    }
  }

  /**
   * Parse plain text file
   */
  private async parseText(file: File): Promise<ParsedDocument> {
    const content = await this.readFileAsText(file);
    
    return {
      name: file.name,
      type: 'txt',
      content,
      metadata: {
        wordCount: this.countWords(content),
        charCount: content.length,
        paragraphs: this.countParagraphs(content),
      },
    };
  }

  /**
   * Parse Markdown file
   */
  private async parseMarkdown(file: File): Promise<ParsedDocument> {
    const content = await this.readFileAsText(file);
    const headings = this.extractHeadings(content);

    return {
      name: file.name,
      type: 'markdown',
      content,
      metadata: {
        wordCount: this.countWords(content),
        charCount: content.length,
        paragraphs: this.countParagraphs(content),
        headings,
      },
    };
  }

  /**
   * Parse PDF file (using pdf.js or similar)
   * For now, returns placeholder - in production use pdf.js
   */
  private async parsePDF(file: File): Promise<ParsedDocument> {
    logger.warn('PDF parsing requires pdf.js - using placeholder');
    
    // In production, integrate pdf.js:
    // import * as pdfjs from 'pdfjs-dist';
    // const arrayBuffer = await file.arrayBuffer();
    // const pdf = await pdfjs.getDocument(arrayBuffer).promise;
    // Extract text from each page...

    // Placeholder: Read as text (won't work for actual PDFs)
    const content = await this.readFileAsText(file);

    return {
      name: file.name,
      type: 'pdf',
      content: content || '[PDF content requires pdf.js library]',
      metadata: {
        wordCount: 0,
        charCount: 0,
        paragraphs: 0,
        note: 'Install pdf.js for full PDF support',
      },
    };
  }

  /**
   * Parse DOCX file
   * For now, returns placeholder - in production use mammoth.js
   */
  private async parseDOCX(file: File): Promise<ParsedDocument> {
    logger.warn('DOCX parsing requires mammoth.js - using placeholder');

    // In production, integrate mammoth.js:
    // const arrayBuffer = await file.arrayBuffer();
    // const result = await mammoth.extractRawText({ arrayBuffer });
    // return result.value;

    return {
      name: file.name,
      type: 'docx',
      content: '[DOCX content requires mammoth.js library]',
      metadata: {
        wordCount: 0,
        charCount: 0,
        paragraphs: 0,
        note: 'Install mammoth.js for full DOCX support',
      },
    };
  }

  /**
   * Read File as text
   */
  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Count paragraphs in text
   */
  private countParagraphs(text: string): number {
    return text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  }

  /**
   * Extract headings from Markdown
   */
  private extractHeadings(content: string): string[] {
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings: string[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      headings.push(`${'  '.repeat(level)}${text}`);
    }

    return headings;
  }

  /**
   * Clean and normalize text content
   */
  cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
}

/**
 * Text Splitter - Split text into chunks for RAG
 */
export interface TextSplitterOptions {
  chunkSize: number;
  chunkOverlap: number;
  separator?: string;
}

export class TextSplitter {
  private options: TextSplitterOptions;

  constructor(options: TextSplitterOptions) {
    this.options = {
      chunkSize: 500,
      chunkOverlap: 50,
      separator: '\n',
      ...options,
    };
  }

  /**
   * Split text into chunks
   */
  split(text: string): string[] {
    const { chunkSize, chunkOverlap, separator } = this.options;
    const chunks: string[] = [];

    // First split by separator (usually paragraphs)
    const splits = text.split(separator).filter(s => s.trim().length > 0);

    let currentChunk = '';
    let currentIndex = 0;

    for (const split of splits) {
      const textToAdd = currentChunk ? separator + split : split;

      if ((currentChunk + textToAdd).length <= chunkSize) {
        currentChunk += textToAdd;
      } else {
        // Current chunk is full, save it
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }

        // Start new chunk with overlap
        if (chunkOverlap > 0 && chunks.length > 0) {
          const lastChunk = chunks[chunks.length - 1];
          const overlapText = lastChunk.slice(-chunkOverlap);
          currentChunk = overlapText + separator + split;
        } else {
          currentChunk = split;
        }
      }
    }

    // Add remaining chunk
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    // If any chunk is still too large, split by character count
    return chunks.flatMap(chunk => {
      if (chunk.length <= chunkSize) return [chunk];
      return this.splitBySize(chunk, chunkSize);
    });
  }

  /**
   * Split text by character count
   */
  private splitBySize(text: string, maxSize: number): string[] {
    const chunks: string[] = [];
    
    for (let i = 0; i < text.length; i += maxSize) {
      chunks.push(text.slice(i, i + maxSize));
    }

    return chunks;
  }
}

// Export singleton
export const documentParser = new DocumentParser();
