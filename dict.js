/**
 * 词迹 WordTrace - 智能权威双语词典与短语搭配引擎
 * 1. 支持单词与多词短语 (Phrases, 如 look forward to, struggle with)
 * 2. 词形变位智能还原 (struggled with -> struggle with)
 * 3. 地道英英释义 (English Definition)
 * 4. 固化常用经典搭配 (Common Collocations)
 */
class DictionaryEngine {
  constructor() {
    this.cache = new Map();

    // 常用不规则动词表
    this.irregulars = {
      'told': ['tell', '过去式/过去分词'],
      'telling': ['tell', '现在分词/进行时'],
      'tells': ['tell', '第三人称单数'],
      'went': ['go', '过去式'],
      'gone': ['go', '过去分词'],
      'going': ['go', '现在分词/进行时'],
      'goes': ['go', '第三人称单数'],
      'saw': ['see', '过去式'],
      'seen': ['see', '过去分词'],
      'took': ['take', '过去式'],
      'taken': ['take', '过去分词'],
      'came': ['come', '过去式'],
      'coming': ['come', '现在分词/进行时'],
      'ran': ['run', '过去式'],
      'running': ['run', '现在分词/进行时'],
      'made': ['make', '过去式/过去分词'],
      'knew': ['know', '过去式'],
      'thought': ['think', '过去式/过去分词'],
      'felt': ['feel', '过去式/过去分词'],
      'found': ['find', '过去式/过去分词'],
      'gave': ['give', '过去式'],
      'given': ['give', '过去分词'],
      'became': ['become', '过去式'],
      'left': ['leave', '过去式/过去分词'],
      'brought': ['bring', '过去式/过去分词'],
      'began': ['begin', '过去式'],
      'kept': ['keep', '过去式/过去分词'],
      'held': ['hold', '过去式/过去分词'],
      'written': ['write', '过去分词'],
      'wrote': ['write', '过去式'],
      'stood': ['stand', '过去式/过去分词'],
      'lost': ['lose', '过去式/过去分词'],
      'paid': ['pay', '过去式/过去分词'],
      'met': ['meet', '过去式/过去分词'],
      'built': ['build', '过去式/过去分词'],
      'children': ['child', '复数形式'],
      'men': ['man', '复数形式'],
      'women': ['woman', '复数形式'],
      'people': ['person', '复数形式'],
      'feet': ['foot', '复数形式'],
      'teeth': ['tooth', '复数形式']
    };
  }

  /**
   * 单词或词组的变位还原
   * 支持多词短语首词变位还原 (如 struggled with -> struggle with)
   */
  resolveInflection(rawText) {
    const text = rawText.toLowerCase().trim().replace(/\s+/g, ' ');
    const dict = window.WORDTRACE_CORE_DICT || {};

    // 1. 如果完全精确匹配（单词或短语）
    if (dict[text]) {
      return { baseWord: text, relation: '' };
    }

    // 2. 如果是多词短语 (如 struggled with, looking forward to)
    const words = text.split(' ');
    if (words.length > 1) {
      const firstWord = words[0];
      const rest = words.slice(1).join(' ');

      // 检查首词是否有不规则变位
      if (this.irregulars[firstWord]) {
        const [baseFirst, rel] = this.irregulars[firstWord];
        const candidatePhrase = `${baseFirst} ${rest}`;
        if (dict[candidatePhrase]) {
          return { baseWord: candidatePhrase, relation: `${candidatePhrase} 的${rel}` };
        }
      }

      // 检查首词是否是规则过去式 -ed / -d
      if (firstWord.endsWith('ed')) {
        let baseFirst = firstWord.slice(0, -1);
        let cand = `${baseFirst} ${rest}`;
        if (dict[cand]) return { baseWord: cand, relation: `${cand} 的过去式/分词` };
        baseFirst = firstWord.slice(0, -2);
        cand = `${baseFirst} ${rest}`;
        if (dict[cand]) return { baseWord: cand, relation: `${cand} 的过去式/分词` };
      }

      // 检查首词进行时 -ing
      if (firstWord.endsWith('ing')) {
        let baseFirst = firstWord.slice(0, -3);
        let cand = `${baseFirst} ${rest}`;
        if (dict[cand]) return { baseWord: cand, relation: `${cand} 的进行时` };
        baseFirst = firstWord.slice(0, -3) + 'e';
        cand = `${baseFirst} ${rest}`;
        if (dict[cand]) return { baseWord: cand, relation: `${cand} 的进行时` };
      }

      // 检查首词三单 -s
      if (firstWord.endsWith('s')) {
        const baseFirst = firstWord.slice(0, -1);
        const cand = `${baseFirst} ${rest}`;
        if (dict[cand]) return { baseWord: cand, relation: `${cand} 的第三人称单数` };
      }

      return { baseWord: text, relation: '' };
    }

    // 3. 单个单词的规则与不规则还原
    const word = text;
    if (this.irregulars[word]) {
      const [base, rel] = this.irregulars[word];
      return { baseWord: base, relation: `${base} 的${rel}` };
    }

    // 副词 -ly 还原 (immensely -> immense)
    if (word.endsWith('ly') && word.length > 4) {
      const stem1 = word.slice(0, -2);
      if (dict[stem1]) return { baseWord: stem1, relation: `${stem1} 的副词形式` };
      if (word.endsWith('ily') && word.length > 5) {
        const stem2 = word.slice(0, -3) + 'y';
        if (dict[stem2]) return { baseWord: stem2, relation: `${stem2} 的副词形式` };
      }
    }

    // 名词复数 -s
    if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
      if (word.endsWith('ies') && word.length > 4) {
        const stem = word.slice(0, -3) + 'y';
        if (dict[stem]) return { baseWord: stem, relation: `${stem} 的复数形式` };
      }
      if (word.endsWith('es') && word.length > 3) {
        const stem = word.slice(0, -2);
        if (dict[stem]) return { baseWord: stem, relation: `${stem} 的复数形式` };
      }
      const stem = word.slice(0, -1);
      if (dict[stem]) return { baseWord: stem, relation: `${stem} 的复数形式` };
    }

    // 动词过去式/分词 -ed
    if (word.endsWith('ed') && word.length > 4) {
      if (word.endsWith('ied')) {
        const stem = word.slice(0, -3) + 'y';
        if (dict[stem]) return { baseWord: stem, relation: `${stem} 的过去式/分词` };
      }
      const stem2 = word.slice(0, -1);
      if (dict[stem2]) return { baseWord: stem2, relation: `${stem2} 的过去式/分词` };
      const stem1 = word.slice(0, -2);
      if (dict[stem1]) return { baseWord: stem1, relation: `${stem1} 的过去式/分词` };
      if (stem1.length > 3 && stem1[stem1.length - 1] === stem1[stem1.length - 2]) {
        const stem3 = stem1.slice(0, -1);
        if (dict[stem3]) return { baseWord: stem3, relation: `${stem3} 的过去式/分词` };
      }
    }

    // 进行时 -ing
    if (word.endsWith('ing') && word.length > 4) {
      const stem1 = word.slice(0, -3);
      if (dict[stem1]) return { baseWord: stem1, relation: `${stem1} 的现在分词/进行时` };
      const stem2 = word.slice(0, -3) + 'e';
      if (dict[stem2]) return { baseWord: stem2, relation: `${stem2} 的现在分词/进行时` };
      if (stem1.length > 3 && stem1[stem1.length - 1] === stem1[stem1.length - 2]) {
        const stem3 = stem1.slice(0, -1);
        if (dict[stem3]) return { baseWord: stem3, relation: `${stem3} 的现在分词/进行时` };
      }
    }

    return { baseWord: word, relation: '' };
  }

  /**
   * 将词条信息排版为结构化、层次鲜明的富文本 HTML
   * 包含：英英释义卡片、中文释义胶囊、经典常用固定搭配列表
   */
  renderRichCardHTML(entryData) {
    const { phonetic, zhDef, enDef, collocations } = entryData;
    let html = '';

    // 1. 地道英英释义模块
    if (enDef) {
      html += `
        <div class="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-xs text-blue-950 dark:text-blue-200 mb-2 leading-relaxed">
          <div class="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400 mb-0.5 flex items-center gap-1">
            <span>📖 ENGLISH DEFINITION</span>
          </div>
          <div class="italic font-serif">“${enDef}”</div>
        </div>
      `;
    }

    // 2. 中文权威释义 (带词性胶囊徽章)
    const formattedZh = zhDef.replace(/\b(n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|phrase|v\.\/n\.|n\.\/v\.)\.\s*/g, (match) => {
      return `<span class="inline-block px-1.5 py-0.2 mr-1 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-mono font-bold text-[11px]">${match.trim()}</span>`;
    });

    html += `
      <div class="text-xs text-[var(--text-main)] leading-relaxed mb-2 font-medium">
        ${formattedZh}
      </div>
    `;

    // 3. 经典常见固定搭配 (固有属性，不以用户文章为准)
    if (collocations && collocations.length > 0) {
      html += `
        <div class="pt-2 border-t border-[var(--border-color)] mt-2">
          <div class="text-[10px] font-bold text-[var(--text-muted)] tracking-wider mb-1.5 flex items-center gap-1">
            <span>✨ 经典常见搭配 (COLLOCATIONS)</span>
          </div>
          <ul class="space-y-1">
      `;
      collocations.forEach(col => {
        html += `
          <li class="text-[11px] text-[var(--text-main)] flex items-start gap-1.5">
            <span class="text-blue-500 font-bold">•</span>
            <span class="leading-tight">${col}</span>
          </li>
        `;
      });
      html += `</ul></div>`;
    }

    return html;
  }

  /**
   * 查词主入口
   */
  async lookup(rawText) {
    // 支持单词与词组清理（允许空格）
    const cleanText = rawText.toLowerCase().replace(/[^a-z'\s-]/g, '').trim().replace(/\s+/g, ' ');
    if (!cleanText) return null;

    if (this.cache.has(cleanText)) {
      return this.cache.get(cleanText);
    }

    const dict = window.WORDTRACE_CORE_DICT || {};
    const { baseWord, relation } = this.resolveInflection(cleanText);

    let entry = dict[baseWord] || dict[cleanText];

    if (entry) {
      const phonetic = entry[0] || '';
      const zhDef = entry[1] || '';
      const enDef = entry[2] || '';
      const collocations = entry[3] || [];

      const richHTML = this.renderRichCardHTML({ phonetic, zhDef, enDef, collocations });

      const res = {
        word: cleanText,
        baseWord: baseWord,
        relationTag: relation,
        phonetic: phonetic,
        definition: zhDef,
        enDef: enDef,
        collocations: collocations,
        formattedHTML: richHTML,
        source: cleanText.includes(' ') ? '权威高频词组' : '牛津/核心英汉'
      };
      this.cache.set(cleanText, res);
      return res;
    }

    // 未收录时的友好提示
    const isPhrase = cleanText.includes(' ');
    const fallbackHTML = `
      <div class="text-xs text-[var(--text-muted)] leading-relaxed">
        当前高频库未收录该${isPhrase ? '词组' : '生词'}。可放入 dicts/ 扩展，或点击右上角「自定义释义」录入笔记。
      </div>
    `;

    return {
      word: cleanText,
      baseWord: baseWord,
      relationTag: relation,
      phonetic: isPhrase ? '' : `/${baseWord}/`,
      definition: `暂未收录该${isPhrase ? '词组' : '单词'}`,
      enDef: '',
      collocations: [],
      formattedHTML: fallbackHTML,
      source: isPhrase ? '词组待扩展' : '单词待扩展',
      needExtension: true
    };
  }

  speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  }
}

window.dictEngine = new DictionaryEngine();
