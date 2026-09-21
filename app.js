/**
 * 词迹 WordTrace - 主应用控制器
 * Read it. Meet it. Remember it.
 */
class WordTraceApp {
  constructor() {
    this.currentArticle = null;
    this.currentBubbleData = null;
    this.currentReviewList = [];
    this.currentReviewIndex = 0;
    this.isCardFlipped = false;
  }

  async init() {
    if (window.lucide) window.lucide.createIcons();

    // 注册 PWA Service Worker (v2)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.log('PWA ServiceWorker register failed: ', err);
      });
    }

    // 绑定划词监听 (放宽至支持 1~5 词的多词词组)
    const readerEl = document.getElementById('reading-body');
    if (readerEl) {
      readerEl.addEventListener('mouseup', (e) => this.handleTextSelection(e));
      readerEl.addEventListener('touchend', (e) => {
        setTimeout(() => this.handleTextSelection(e), 100);
      });
    }

    // 点击空白处关闭气泡
    document.addEventListener('mousedown', (e) => {
      const bubble = document.getElementById('lookup-bubble');
      if (bubble && !bubble.contains(e.target) && !e.target.closest('#reading-body')) {
        this.closeBubble();
      }
    });

    await this.loadArticles();
    await this.updateReviewBadge();

    const savedTheme = localStorage.getItem('wordtrace_theme') || 'default';
    this.setTheme(savedTheme);
  }

  // ==================== 标签页与主题 ====================
  switchTab(tabName) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(el => {
      el.classList.remove('active', 'bg-blue-500/10', 'text-blue-600');
      el.classList.add('text-[var(--text-muted)]');
    });

    const activeNav = document.getElementById(`nav-${tabName}`);
    if (activeNav) {
      activeNav.classList.add('active', 'bg-blue-500/10', 'text-blue-600');
      activeNav.classList.remove('text-[var(--text-muted)]');
    }

    const activeTab = document.getElementById(`tab-${tabName}`);
    if (activeTab) activeTab.classList.remove('hidden');

    if (tabName === 'review') {
      this.initReviewSession();
    } else if (tabName === 'vocab') {
      this.loadVocabList();
    } else if (tabName === 'share') {
      this.populateShareOptions();
    }

    if (window.lucide) window.lucide.createIcons();
  }

  setTheme(theme) {
    document.body.className = `theme-${theme}`;
    localStorage.setItem('wordtrace_theme', theme);
  }

  // ==================== 1. 阅读器逻辑 ====================
  async loadArticles() {
    const articles = await window.wordTraceDB.getArticles();
    const listEl = document.getElementById('article-list');
    listEl.innerHTML = '';

    if (articles.length === 0) {
      listEl.innerHTML = `
        <div class="p-3 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-color)] rounded-lg">
          暂无文章，点击上方「新增」
        </div>`;
      return;
    }

    articles.forEach((art) => {
      const item = document.createElement('div');
      item.className = `p-3 rounded-lg border text-xs cursor-pointer transition-all ${
        this.currentArticle && this.currentArticle.id === art.id
          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 font-semibold'
          : 'border-[var(--border-color)] hover:bg-[var(--bg-muted)]'
      }`;
      item.onclick = () => this.selectArticle(art.id);
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="truncate font-medium">${art.title}</span>
          <span class="text-[10px] text-[var(--text-muted)]">${art.wordCount || 0}词</span>
        </div>
        <div class="text-[10px] text-[var(--text-muted)] mt-1">
          ${new Date(art.createdAt).toLocaleDateString()}
        </div>
      `;
      listEl.appendChild(item);
    });

    if (!this.currentArticle && articles.length > 0) {
      this.selectArticle(articles[0].id);
    }
  }

  async selectArticle(id) {
    const article = await window.wordTraceDB.getArticle(id);
    if (!article) return;
    this.currentArticle = article;

    document.getElementById('reading-title').textContent = article.title;
    document.getElementById('meta-date').textContent = '添加于: ' + new Date(article.createdAt).toLocaleDateString();
    document.getElementById('meta-words').textContent = `${article.wordCount || 0} 词`;
    document.getElementById('reading-actions').classList.remove('hidden');

    await this.renderArticleWithHighlights();
    await this.loadArticles();
    if (window.lucide) window.lucide.createIcons();
  }

  async renderArticleWithHighlights() {
    if (!this.currentArticle) return;
    const bodyEl = document.getElementById('reading-body');
    const words = await window.wordTraceDB.getWordsByArticle(this.currentArticle.id);
    
    let content = this.currentArticle.content;

    // 按词长降序排列，优先精准匹配长词组（如 look forward to 优先于 look）
    if (words.length > 0) {
      const sortedWords = words.sort((a, b) => b.word.length - a.word.length);
      sortedWords.forEach(w => {
        // 安全转义正则特殊符号
        const escaped = w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
        content = content.replace(regex, `<span class="word-highlight" data-word="${w.word}">$1</span>`);
      });
    }

    bodyEl.innerHTML = content;

    bodyEl.querySelectorAll('.word-highlight').forEach(span => {
      span.onclick = async (e) => {
        e.stopPropagation();
        const clickedWord = span.getAttribute('data-word');
        const rect = span.getBoundingClientRect();
        await this.triggerLookup(clickedWord, span.innerText, rect, this.getSentenceAround(span));
      };
    });
  }

  getSentenceAround(node) {
    let p = node.closest('p') || node.parentElement;
    return p ? p.innerText.trim() : node.innerText;
  }

  // ==================== 划词与气泡查词 (放宽支持 1~5 词组) ====================
  async handleTextSelection(e) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // 放宽限制：允许划选 1 到 5 个词组成的短语
    const wordCount = selectedText.split(/\s+/).length;
    if (!selectedText || selectedText.length < 2 || wordCount > 5) {
      return;
    }

    // 过滤两端标点，保留内部合法字符
    const cleanWord = selectedText.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').trim();
    if (!cleanWord || !/^[a-zA-Z'-\s]+$/.test(cleanWord)) return;

    let contextSentence = '';
    if (selection.anchorNode) {
      const fullText = selection.anchorNode.textContent || '';
      const offset = selection.anchorOffset;
      const start = Math.max(fullText.lastIndexOf('.', offset), fullText.lastIndexOf('!', offset), fullText.lastIndexOf('?', offset), fullText.lastIndexOf('\n', offset)) + 1;
      let end = fullText.indexOf('.', offset);
      if (end === -1) end = fullText.length;
      else end += 1;

      contextSentence = fullText.substring(start, end).trim();
    }
    if (!contextSentence) contextSentence = `"...${selectedText}..."`;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    await this.triggerLookup(cleanWord, selectedText, rect, contextSentence);
  }

  async triggerLookup(word, originalSelected, rect, contextSentence) {
    const bubble = document.getElementById('lookup-bubble');
    const wordEl = document.getElementById('bubble-word');
    const relEl = document.getElementById('bubble-relation');
    const phoneticEl = document.getElementById('bubble-phonetic');
    const defEl = document.getElementById('bubble-def');

    wordEl.textContent = word;
    relEl.classList.add('hidden');
    phoneticEl.textContent = '查询中...';
    defEl.textContent = '正在获取释义...';

    // 定位气泡
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    bubble.style.left = `${rect.left + rect.width / 2 + scrollX}px`;
    bubble.style.top = `${rect.bottom + 8 + scrollY}px`;
    bubble.style.display = 'block';

    // 智能查询（支持词组与单词）
    const info = await window.dictEngine.lookup(word);
    wordEl.textContent = info.word;

    // 显示语法变位徽章 (如: struggled with -> struggle with 的过去式)
    if (info.relationTag) {
      relEl.textContent = info.relationTag;
      relEl.classList.remove('hidden');
    } else {
      relEl.classList.add('hidden');
    }

    phoneticEl.textContent = info.phonetic || (info.word.includes(' ') ? '（短语搭配）' : '/--/');
    
    // 富文本呈现：英英释义 + 中文释义 + 经典常用搭配
    defEl.innerHTML = `
      <div class="mb-1 text-[10px] text-blue-500 font-semibold flex items-center gap-1">
        <span>[${info.source}]</span>
      </div>
      ${info.formattedHTML}
    `;

    this.currentBubbleData = {
      word: info.word,
      originalSelected: originalSelected,
      relationTag: info.relationTag || '',
      phonetic: info.phonetic,
      definition: info.definition,
      enDef: info.enDef || '',
      collocations: info.collocations || [],
      contextSentence: contextSentence,
      articleId: this.currentArticle ? this.currentArticle.id : null,
      articleTitle: this.currentArticle ? this.currentArticle.title : '独立划词'
    };

    if (window.lucide) window.lucide.createIcons();
  }

  closeBubble() {
    const bubble = document.getElementById('lookup-bubble');
    if (bubble) bubble.style.display = 'none';
    this.currentBubbleData = null;
  }

  speakBubbleWord() {
    if (this.currentBubbleData) {
      window.dictEngine.speak(this.currentBubbleData.word);
    }
  }

  async addBubbleWordToVocab() {
    if (!this.currentBubbleData) return;
    await window.wordTraceDB.addWord(this.currentBubbleData);
    
    const addBtn = document.getElementById('bubble-add-btn');
    addBtn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> 已收录';
    addBtn.classList.replace('btn-primary', 'bg-emerald-600');
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      this.closeBubble();
      addBtn.classList.replace('bg-emerald-600', 'btn-primary');
      addBtn.innerHTML = '<i data-lucide="plus-circle" class="w-3.5 h-3.5"></i> 收入生词本';
    }, 600);

    await this.renderArticleWithHighlights();
    await this.updateReviewBadge();
  }

  // ==================== 文章模态框 ====================
  openNewArticleModal() {
    document.getElementById('input-article-title').value = '';
    document.getElementById('input-article-content').value = '';
    document.getElementById('modal-article').classList.add('open');
  }

  closeNewArticleModal() {
    document.getElementById('modal-article').classList.remove('open');
  }

  readLocalTextFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      document.getElementById('input-article-content').value = event.target.result;
      if (!document.getElementById('input-article-title').value) {
        document.getElementById('input-article-title').value = file.name.replace(/\.[^/.]+$/, '');
      }
    };
    reader.readAsText(file);
  }

  async saveNewArticle() {
    const title = document.getElementById('input-article-title').value.trim();
    const content = document.getElementById('input-article-content').value.trim();
    if (!content) {
      alert('请粘贴文章内容或选择文本文件！');
      return;
    }
    const newId = await window.wordTraceDB.saveArticle(title, content);
    this.closeNewArticleModal();
    await this.loadArticles();
    await this.selectArticle(newId);
  }

  async deleteCurrentArticle() {
    if (!this.currentArticle) return;
    if (confirm(`确定要删除文章《${this.currentArticle.title}》吗？（文章内的单词/短语仍会保留在单词本中）`)) {
      await window.wordTraceDB.deleteArticle(this.currentArticle.id);
      this.currentArticle = null;
      document.getElementById('reading-title').textContent = '请在左侧选择或新增文章';
      document.getElementById('reading-body').innerHTML = '<div class="text-center py-16 text-[var(--text-muted)]">文章已删除</div>';
      document.getElementById('reading-actions').classList.add('hidden');
      await this.loadArticles();
    }
  }

  // ==================== 2. 记忆复习卡片 (SM-2) ====================
  async updateReviewBadge() {
    const dueWords = await window.wordTraceDB.getDueWords();
    const badge = document.getElementById('review-badge');
    if (dueWords.length > 0) {
      badge.textContent = dueWords.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  async initReviewSession() {
    this.currentReviewList = await window.wordTraceDB.getDueWords();
    this.currentReviewIndex = 0;
    this.isCardFlipped = false;

    const counterEl = document.getElementById('due-count');
    counterEl.textContent = this.currentReviewList.length;

    const cardEl = document.getElementById('flashcard-card');
    const emptyEl = document.getElementById('review-empty');
    const buttonsEl = document.getElementById('review-buttons');

    if (this.currentReviewList.length === 0) {
      cardEl.parentElement.classList.add('hidden');
      buttonsEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
    } else {
      cardEl.parentElement.classList.remove('hidden');
      buttonsEl.classList.remove('hidden');
      emptyEl.classList.add('hidden');
      await this.showCurrentReviewCard();
    }
  }

  async showCurrentReviewCard() {
    const wordData = this.currentReviewList[this.currentReviewIndex];
    if (!wordData) return;

    this.isCardFlipped = false;
    document.getElementById('flashcard-card').classList.remove('flipped');

    // 智能更新补全 (如果老数据缺少富文本，自动从最新词库重新载入)
    if (!wordData.enDef && !wordData.collocations) {
      const freshInfo = await window.dictEngine.lookup(wordData.word);
      if (freshInfo && (freshInfo.enDef || (freshInfo.collocations && freshInfo.collocations.length > 0))) {
        wordData.enDef = freshInfo.enDef || '';
        wordData.collocations = freshInfo.collocations || [];
        wordData.phonetic = freshInfo.phonetic || wordData.phonetic;
        wordData.relationTag = freshInfo.relationTag || '';
        const tx = window.wordTraceDB.db.transaction(['words'], 'readwrite');
        tx.objectStore('words').put(wordData);
      }
    }

    // 正面
    document.getElementById('card-source').textContent = `📖 来自文章: 《${wordData.articleTitle || '无标题'}》`;
    document.getElementById('card-word').textContent = wordData.word;
    document.getElementById('card-phonetic').textContent = wordData.phonetic || (wordData.word.includes(' ') ? '（短语搭配）' : '');
    
    // 语法关系展示
    const relEl = document.getElementById('card-relation');
    if (wordData.relationTag) {
      relEl.textContent = wordData.relationTag;
      relEl.classList.remove('hidden');
    } else {
      relEl.classList.add('hidden');
    }

    // 语境原句高亮 (支持词组安全高亮)
    let context = wordData.contextSentence || '（无上下文句子）';
    const escaped = wordData.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
    context = context.replace(regex, `<span class="bg-amber-200 dark:bg-amber-800 font-bold px-1 rounded">$1</span>`);
    document.getElementById('card-context').innerHTML = `“${context}”`;

    // 背面：使用富文本渲染（英英释义 + 中文释义 + 经典搭配）
    document.getElementById('card-back-word').textContent = wordData.word;
    document.getElementById('card-added-time').textContent = `添加于: ${new Date(wordData.createdAt).toLocaleDateString()}`;
    
    const richHTML = window.dictEngine.renderRichCardHTML({
      phonetic: wordData.phonetic,
      zhDef: wordData.definition,
      enDef: wordData.enDef,
      collocations: wordData.collocations
    });
    document.getElementById('card-definition').innerHTML = richHTML;

    document.getElementById('due-count').textContent = `${this.currentReviewIndex + 1} / ${this.currentReviewList.length}`;
    if (window.lucide) window.lucide.createIcons();
  }

  flipCard() {
    this.isCardFlipped = !this.isCardFlipped;
    const card = document.getElementById('flashcard-card');
    if (this.isCardFlipped) {
      card.classList.add('flipped');
    } else {
      card.classList.remove('flipped');
    }
  }

  speakCurrentWord() {
    const wordData = this.currentReviewList[this.currentReviewIndex];
    if (wordData) {
      window.dictEngine.speak(wordData.word);
    }
  }

  async editCurrentCardDefinition() {
    const wordData = this.currentReviewList[this.currentReviewIndex];
    if (!wordData) return;
    const newDef = prompt(`修改【${wordData.word}】的中文释义：`, wordData.definition || '');
    if (newDef !== null && newDef.trim() !== '') {
      wordData.definition = newDef.trim();
      const richHTML = window.dictEngine.renderRichCardHTML({
        phonetic: wordData.phonetic,
        zhDef: wordData.definition,
        enDef: wordData.enDef,
        collocations: wordData.collocations
      });
      document.getElementById('card-definition').innerHTML = richHTML;
      const tx = window.wordTraceDB.db.transaction(['words'], 'readwrite');
      tx.objectStore('words').put(wordData);
    }
  }

  async gradeWord(grade) {
    const currentWord = this.currentReviewList[this.currentReviewIndex];
    if (!currentWord) return;

    const updatedSrs = window.srsEngine.calculate(currentWord.srs, grade);
    await window.wordTraceDB.updateSrs(currentWord.id, updatedSrs);

    this.currentReviewIndex += 1;
    if (this.currentReviewIndex < this.currentReviewList.length) {
      await this.showCurrentReviewCard();
    } else {
      await this.initReviewSession();
      await this.updateReviewBadge();
    }
  }

  // ==================== 3. 单词本 ====================
  async loadVocabList() {
    const words = await window.wordTraceDB.getAllWords();
    this.renderVocabGrid(words);
  }

  filterVocab() {
    const query = document.getElementById('vocab-search').value.toLowerCase().trim();
    window.wordTraceDB.getAllWords().then(words => {
      const filtered = words.filter(w => 
        w.word.toLowerCase().includes(query) || 
        (w.definition && w.definition.toLowerCase().includes(query)) ||
        (w.contextSentence && w.contextSentence.toLowerCase().includes(query))
      );
      this.renderVocabGrid(filtered);
    });
  }

  renderVocabGrid(words) {
    const grid = document.getElementById('vocab-grid');
    const empty = document.getElementById('vocab-empty');
    document.getElementById('vocab-total-count').textContent = words.length;

    grid.innerHTML = '';
    if (words.length === 0) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    words.forEach(w => {
      const card = document.createElement('div');
      card.className = 'bg-[var(--bg-surface)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm space-y-2.5 flex flex-col justify-between';
      
      const richHTML = window.dictEngine.renderRichCardHTML({
        phonetic: w.phonetic,
        zhDef: w.definition,
        enDef: w.enDef,
        collocations: w.collocations
      });

      card.innerHTML = `
        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-lg text-blue-600 dark:text-blue-400">${w.word}</span>
              ${w.relationTag ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium">${w.relationTag}</span>` : ''}
              <span class="font-mono text-xs text-[var(--text-muted)]">${w.phonetic || ''}</span>
            </div>
            <button onclick="window.dictEngine.speak('${w.word}')" class="p-1 rounded text-[var(--text-muted)] hover:text-blue-500">
              <i data-lucide="volume-2" class="w-4 h-4"></i>
            </button>
          </div>
          <div class="text-xs text-[var(--text-main)] line-clamp-4 leading-relaxed">
            ${richHTML}
          </div>
        </div>

        <div class="space-y-2 pt-2 border-t border-[var(--border-color)]">
          <div class="text-[11px] text-[var(--text-muted)] italic line-clamp-2 bg-[var(--bg-muted)] p-2 rounded-lg">
            “${w.contextSentence || '无上下文原句'}”
          </div>
          <div class="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span class="truncate max-w-[150px]">📖 ${w.articleTitle || '独立收录'}</span>
            <button onclick="app.deleteVocabWord(${w.id})" class="text-red-400 hover:text-red-600 p-1" title="删除生词">
              <i data-lucide="trash" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  async deleteVocabWord(id) {
    if (confirm('确定要从生词本中移除该项吗？')) {
      await window.wordTraceDB.deleteWord(id);
      await this.loadVocabList();
      await this.updateReviewBadge();
      if (this.currentArticle) {
        await this.renderArticleWithHighlights();
      }
    }
  }

  // ==================== 4. 微信友好 .txt 导出与共读分享 ====================
  async populateShareOptions() {
    const articles = await window.wordTraceDB.getArticles();
    const select = document.getElementById('share-book-select');
    select.innerHTML = '<option value="">选择要分享的一本书/文章...</option>';
    articles.forEach(art => {
      const opt = document.createElement('option');
      opt.value = art.id;
      opt.textContent = `《${art.title}》 (${new Date(art.createdAt).toLocaleDateString()})`;
      select.appendChild(opt);
    });
  }

  downloadTxtFile(filename, textContent) {
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async exportFullBackup() {
    const data = await window.wordTraceDB.exportAllData();
    const text = JSON.stringify(data, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadTxtFile(`词迹WordTrace_全量备份_${dateStr}.txt`, text);
  }

  async exportCurrentBook() {
    if (!this.currentArticle) return;
    await this.exportBookById(this.currentArticle.id);
  }

  async exportSelectedBook() {
    const select = document.getElementById('share-book-select');
    const articleId = select.value;
    if (!articleId) {
      alert('请先选择一本书或文章！');
      return;
    }
    await this.exportBookById(articleId);
  }

  async exportBookById(articleId) {
    const data = await window.wordTraceDB.exportBookData(articleId);
    if (!data) return;
    const text = JSON.stringify(data, null, 2);
    const safeTitle = data.article.title.replace(/[\\/:*?"<>|]/g, '_');
    this.downloadTxtFile(`[词迹共读]_${safeTitle}.txt`, text);
  }

  handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const raw = event.target.result;
        const data = JSON.parse(raw);
        await this.processImportData(data);
      } catch (err) {
        alert('导入失败：文件损坏或并非词迹导出的 .txt 数据！\n' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async handlePasteImport() {
    const text = document.getElementById('import-paste-text').value.trim();
    if (!text) {
      alert('请先粘贴代码文本！');
      return;
    }
    try {
      const data = JSON.parse(text);
      await this.processImportData(data);
      document.getElementById('import-paste-text').value = '';
    } catch (err) {
      alert('解析失败：请确保复制的是完整的词迹分享代码！\n' + err.message);
    }
  }

  async processImportData(data) {
    if (data.app !== 'WordTrace') {
      throw new Error('未识别到 WordTrace 应用暗号。');
    }

    if (data.exportType === 'full_backup') {
      if (confirm(`识别到【个人全量备份】：包含 ${data.articles?.length || 0} 篇文章，${data.words?.length || 0} 个词汇。\n是否导入合并到当前设备？`)) {
        await window.wordTraceDB.importData(data);
        alert('导入恢复成功！');
        window.location.reload();
      }
    } else if (data.exportType === 'book_share') {
      if (confirm(`识别到朋友分享的【共读书籍】：《${data.article?.title}》，包含 ${data.words?.length || 0} 个生词/短语。\n是否加入你的阅读库与单词本？`)) {
        await window.wordTraceDB.importData(data);
        alert('导入成功！已加入你的文章库，生词已重置为待复习状态。');
        window.location.reload();
      }
    }
  }
}

window.app = new WordTraceApp();
window.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
