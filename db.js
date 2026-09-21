/**
 * 词迹 WordTrace - 本地 IndexedDB 数据库引擎
 * 纯客户端存储：文章数据、生词数据、记忆复习状态
 */
class WordTraceDB {
  constructor() {
    this.dbName = 'WordTraceDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // 文章表 (存储文章标题、正文、创建时间)
        if (!db.objectStoreNames.contains('articles')) {
          const articleStore = db.createObjectStore('articles', { keyPath: 'id', autoIncrement: true });
          articleStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 单词表 (存储单词、音标、释义、上下文例句、所属文章、创建时间)
        if (!db.objectStoreNames.contains('words')) {
          const wordStore = db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
          wordStore.createIndex('word', 'word', { unique: false });
          wordStore.createIndex('articleId', 'articleId', { unique: false });
          wordStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 记忆复习表 (SM-2 算法数据: wordId, repetition, interval, easeFactor, dueDate, reviews)
        if (!db.objectStoreNames.contains('srs')) {
          const srsStore = db.createObjectStore('srs', { keyPath: 'wordId' });
          srsStore.createIndex('dueDate', 'dueDate', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // --- 文章操作 ---
  async saveArticle(title, content) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['articles'], 'readwrite');
      const store = tx.objectStore('articles');
      const article = {
        title: title || '未命名短文 ' + new Date().toLocaleDateString(),
        content: content.trim(),
        wordCount: (content.trim().match(/\b\w+\b/g) || []).length,
        createdAt: new Date().toISOString()
      };
      const req = store.add(article);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getArticles() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['articles'], 'readonly');
      const store = tx.objectStore('articles');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.reverse());
      req.onerror = () => reject(req.error);
    });
  }

  async getArticle(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['articles'], 'readonly');
      const store = tx.objectStore('articles');
      const req = store.get(Number(id));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteArticle(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['articles', 'words'], 'readwrite');
      tx.objectStore('articles').delete(Number(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- 单词操作 ---
  async addWord(wordData) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['words', 'srs'], 'readwrite');
      const wordStore = tx.objectStore('words');
      const srsStore = tx.objectStore('srs');

      const entry = {
        word: wordData.word.toLowerCase().trim(),
        phonetic: wordData.phonetic || '',
        definition: wordData.definition || '',
        contextSentence: wordData.contextSentence || '',
        articleId: Number(wordData.articleId) || null,
        articleTitle: wordData.articleTitle || '独立查词',
        createdAt: wordData.createdAt || new Date().toISOString()
      };

      const wordReq = wordStore.add(entry);
      wordReq.onsuccess = () => {
        const wordId = wordReq.result;
        // 初始化 SM-2 记忆曲线复习卡片
        const srsData = {
          wordId: wordId,
          repetition: 0,
          interval: 0,
          easeFactor: 2.5,
          dueDate: new Date().toISOString(), // 立即待背
          reviewCount: 0,
          lastReviewedAt: null
        };
        srsStore.put(srsData);
        resolve(wordId);
      };
      wordReq.onerror = () => reject(wordReq.error);
    });
  }

  async getAllWords() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['words'], 'readonly');
      const store = tx.objectStore('words');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.reverse());
      req.onerror = () => reject(req.error);
    });
  }

  async getWordsByArticle(articleId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['words'], 'readonly');
      const store = tx.objectStore('words');
      const index = store.index('articleId');
      const req = index.getAll(Number(articleId));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteWord(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['words', 'srs'], 'readwrite');
      tx.objectStore('words').delete(Number(id));
      tx.objectStore('srs').delete(Number(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- 复习数据操作 ---
  async getDueWords() {
    await this.init();
    const allSrs = await new Promise((resolve, reject) => {
      const tx = this.db.transaction(['srs'], 'readonly');
      const req = tx.objectStore('srs').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const now = new Date().toISOString();
    const dueSrs = allSrs.filter(item => item.dueDate <= now);

    const words = await this.getAllWords();
    const wordMap = new Map(words.map(w => [w.id, w]));

    return dueSrs.map(srs => {
      const word = wordMap.get(srs.wordId);
      return word ? { ...word, srs } : null;
    }).filter(Boolean);
  }

  async updateSrs(wordId, updatedSrs) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['srs'], 'readwrite');
      const store = tx.objectStore('srs');
      const req = store.put(updatedSrs);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- 全量导出数据 ---
  async exportAllData() {
    await this.init();
    const articles = await this.getArticles();
    const words = await this.getAllWords();
    const srsList = await new Promise((resolve) => {
      const tx = this.db.transaction(['srs'], 'readonly');
      const req = tx.objectStore('srs').getAll();
      req.onsuccess = () => resolve(req.result);
    });

    return {
      app: 'WordTrace',
      version: '1.0',
      exportType: 'full_backup',
      exportedAt: new Date().toISOString(),
      articles,
      words,
      srsList
    };
  }

  // --- 导出单篇文章/书籍（共读分享）---
  async exportBookData(articleId) {
    const article = await this.getArticle(articleId);
    if (!article) return null;
    const words = await this.getWordsByArticle(articleId);

    return {
      app: 'WordTrace',
      version: '1.0',
      exportType: 'book_share',
      exportedAt: new Date().toISOString(),
      article,
      words: words.map(w => ({
        word: w.word,
        phonetic: w.phonetic,
        definition: w.definition,
        contextSentence: w.contextSentence,
        createdAt: w.createdAt
      }))
    };
  }

  // --- 导入恢复/合并数据 ---
  async importData(data) {
    await this.init();
    if (data.app !== 'WordTrace') {
      throw new Error('无效的词迹数据包！格式不匹配。');
    }

    if (data.exportType === 'full_backup') {
      // 恢复全量备份
      for (const art of (data.articles || [])) {
        await this.saveArticle(art.title, art.content);
      }
      for (const w of (data.words || [])) {
        await this.addWord(w);
      }
    } else if (data.exportType === 'book_share') {
      // 导入单书共读（保存文章，并将里面的单词重置为新词加入生词本）
      const newArticleId = await this.saveArticle(data.article.title + ' (共读共享)', data.article.content);
      for (const w of (data.words || [])) {
        await this.addWord({
          ...w,
          articleId: newArticleId,
          articleTitle: data.article.title
        });
      }
    }
  }
}

window.wordTraceDB = new WordTraceDB();
