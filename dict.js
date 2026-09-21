/**
 * 词迹 WordTrace - 智能权威英汉词典与语法变位感知引擎
 * 1. 完整 8000+ 权威高频词库
 * 2. 词形变位还原 (patterns -> pattern, told -> tell)
 * 3. 规范展示标准词性 (n. 名词, v. 动词, adj. 形容词, adv. 副词等)
 */
class DictionaryEngine {
  constructor() {
    this.cache = new Map();

    // 常用不规则动词与特殊名词变位表
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
      'seeing': ['see', '现在分词/进行时'],
      'sees': ['see', '第三人称单数'],
      'took': ['take', '过去式'],
      'taken': ['take', '过去分词'],
      'taking': ['take', '现在分词/进行时'],
      'takes': ['take', '第三人称单数'],
      'came': ['come', '过去式'],
      'coming': ['come', '现在分词/进行时'],
      'comes': ['come', '第三人称单数'],
      'ran': ['run', '过去式'],
      'running': ['run', '现在分词/进行时'],
      'runs': ['run', '第三人称单数/复数'],
      'made': ['make', '过去式/过去分词'],
      'making': ['make', '现在分词/进行时'],
      'makes': ['make', '第三人称单数/复数'],
      'knew': ['know', '过去式'],
      'known': ['know', '过去分词'],
      'knowing': ['know', '现在分词/进行时'],
      'knows': ['know', '第三人称单数/复数'],
      'thought': ['think', '过去式/过去分词'],
      'thinking': ['think', '现在分词/进行时'],
      'thinks': ['think', '第三人称单数/复数'],
      'felt': ['feel', '过去式/过去分词'],
      'feeling': ['feel', '现在分词/进行时'],
      'feels': ['feel', '第三人称单数/复数'],
      'found': ['find', '过去式/过去分词'],
      'finding': ['find', '现在分词/进行时'],
      'finds': ['find', '第三人称单数/复数'],
      'gave': ['give', '过去式'],
      'given': ['give', '过去分词'],
      'giving': ['give', '现在分词/进行时'],
      'gives': ['give', '第三人称单数/复数'],
      'became': ['become', '过去式'],
      'becoming': ['become', '现在分词/进行时'],
      'becomes': ['become', '第三人称单数'],
      'left': ['leave', '过去式/过去分词'],
      'leaving': ['leave', '现在分词/进行时'],
      'leaves': ['leave', '第三人称单数/复数'],
      'brought': ['bring', '过去式/过去分词'],
      'bringing': ['bring', '现在分词/进行时'],
      'brings': ['bring', '第三人称单数'],
      'began': ['begin', '过去式'],
      'begun': ['begin', '过去分词'],
      'beginning': ['begin', '现在分词/进行时'],
      'begins': ['begin', '第三人称单数'],
      'kept': ['keep', '过去式/过去分词'],
      'keeping': ['keep', '现在分词/进行时'],
      'keeps': ['keep', '第三人称单数/复数'],
      'held': ['hold', '过去式/过去分词'],
      'holding': ['hold', '现在分词/进行时'],
      'holds': ['hold', '第三人称单数/复数'],
      'written': ['write', '过去分词'],
      'wrote': ['write', '过去式'],
      'writing': ['write', '现在分词/进行时'],
      'writes': ['write', '第三人称单数'],
      'stood': ['stand', '过去式/过去分词'],
      'standing': ['stand', '现在分词/进行时'],
      'stands': ['stand', '第三人称单数/复数'],
      'lost': ['lose', '过去式/过去分词'],
      'losing': ['lose', '现在分词/进行时'],
      'loses': ['lose', '第三人称单数'],
      'paid': ['pay', '过去式/过去分词'],
      'paying': ['pay', '现在分词/进行时'],
      'pays': ['pay', '第三人称单数'],
      'met': ['meet', '过去式/过去分词'],
      'meeting': ['meet', '现在分词/进行时'],
      'meets': ['meet', '第三人称单数/复数'],
      'built': ['build', '过去式/过去分词'],
      'building': ['build', '现在分词/建筑'],
      'builds': ['build', '第三人称单数/复数'],
      'understood': ['understand', '过去式/过去分词'],
      'understanding': ['understand', '现在分词/理解'],
      'spoken': ['speak', '过去分词'],
      'spoke': ['speak', '过去式'],
      'speaking': ['speak', '现在分词/进行时'],
      'speaks': ['speak', '第三人称单数'],
      'grown': ['grow', '过去分词'],
      'grew': ['grow', '过去式'],
      'growing': ['grow', '现在分词/进行时'],
      'grows': ['grow', '第三人称单数'],
      'drawn': ['draw', '过去分词'],
      'drew': ['draw', '过去式'],
      'drawing': ['draw', '现在分词/图画'],
      'draws': ['draw', '第三人称单数/复数'],
      'broken': ['break', '过去分词'],
      'broke': ['break', '过去式'],
      'breaking': ['break', '现在分词/进行时'],
      'breaks': ['break', '第三人称单数/复数'],
      'bought': ['buy', '过去式/过去分词'],
      'buying': ['buy', '现在分词/进行时'],
      'buys': ['buy', '第三人称单数'],
      'chosen': ['choose', '过去分词'],
      'chose': ['choose', '过去式'],
      'choosing': ['choose', '现在分词/进行时'],
      'chooses': ['choose', '第三人称单数'],
      'fallen': ['fall', '过去分词'],
      'fell': ['fall', '过去式'],
      'falling': ['fall', '现在分词/进行时'],
      'falls': ['fall', '第三人称单数/复数'],
      'driven': ['drive', '过去分词'],
      'drove': ['drive', '过去式'],
      'driving': ['drive', '现在分词/进行时'],
      'drives': ['drive', '第三人称单数/复数'],
      'children': ['child', '复数形式'],
      'men': ['man', '复数形式'],
      'women': ['woman', '复数形式'],
      'people': ['person', '复数形式'],
      'feet': ['foot', '复数形式'],
      'teeth': ['tooth', '复数形式'],
      'lives': ['life', '复数形式'],
      'knives': ['knife', '复数形式'],
      'wives': ['wife', '复数形式'],
      'leaves': ['leaf', '复数形式']
    };
  }

  /**
   * 智能语法变位还原
   */
  resolveInflection(rawWord) {
    const word = rawWord.toLowerCase().trim();
    const dict = window.WORDTRACE_CORE_DICT || {};

    // 1. 优先查不规则变换
    if (this.irregulars[word]) {
      const [base, rel] = this.irregulars[word];
      return { baseWord: base, relation: `${base} 的${rel}` };
    }

    // 2. 副词 -ly 还原 (immensely -> immense)
    if (word.endsWith('ly') && word.length > 4) {
      const stem1 = word.slice(0, -2);
      if (dict[stem1]) return { baseWord: stem1, relation: `${stem1} 的副词形式` };
      if (word.endsWith('ily') && word.length > 5) {
        const stem2 = word.slice(0, -3) + 'y';
        if (dict[stem2]) return { baseWord: stem2, relation: `${stem2} 的副词形式` };
      }
    }

    // 3. 本身在词典中存在
    if (dict[word]) {
      return { baseWord: word, relation: '' };
    }

    // 4. 名词复数还原 (errors -> error, patterns -> pattern)
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

    // 5. 动词过去式/过去分词还原 (struggled -> struggle)
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

    // 6. 进行时还原 (running -> run)
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

    // 7. 比较级还原
    if (word.endsWith('er') && word.length > 3) {
      const stem1 = word.slice(0, -2);
      if (dict[stem1]) return { baseWord: stem1, relation: `${stem1} 的比较级` };
      const stem2 = word.slice(0, -1);
      if (dict[stem2]) return { baseWord: stem2, relation: `${stem2} 的比较级` };
    }

    return { baseWord: word, relation: '' };
  }

  /**
   * 将含有词性的释义转换成精美的视觉标签 HTML
   * 例如: "n. 误差；错误" -> "<span class='pos-badge'>n.</span> 误差；错误"
   */
  formatDefinitionHTML(rawDef) {
    if (!rawDef) return '暂无释义';
    // 匹配如 n. v. vt. vi. adj. adv. prep. conj. pron. 等
    return rawDef.replace(/\b(n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|v\.\/n\.|n\.\/v\.)\.\s*/g, (match) => {
      return `<span class="inline-block px-1.5 py-0.2 mr-1 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono font-bold text-[11px]">${match.trim()}</span>`;
    });
  }

  /**
   * 查词主入口
   */
  async lookup(rawWord) {
    const cleanWord = rawWord.toLowerCase().replace(/[^a-z'-]/g, '').trim();
    if (!cleanWord) return null;

    if (this.cache.has(cleanWord)) {
      return this.cache.get(cleanWord);
    }

    const dict = window.WORDTRACE_CORE_DICT || {};
    const { baseWord, relation } = this.resolveInflection(cleanWord);

    let entry = dict[baseWord] || dict[cleanWord];

    if (entry) {
      const phonetic = entry[0] || '';
      const definition = entry[1] || '';

      const res = {
        word: cleanWord,
        baseWord: baseWord,
        relationTag: relation,
        phonetic: phonetic,
        definition: definition,
        formattedDef: this.formatDefinitionHTML(definition),
        source: '牛津/四六级核心'
      };
      this.cache.set(cleanWord, res);
      return res;
    }

    return {
      word: cleanWord,
      baseWord: baseWord,
      relationTag: relation,
      phonetic: `/${baseWord}/`,
      definition: `当前 8000 高频词库未收录。可将专业词典放入 dicts/ 目录扩展，或点击右上角「自定义释义」随时录入专属笔记。`,
      formattedDef: `当前 8000 高频词库未收录。可将专业词典放入 dicts/ 目录扩展，或点击右上角「自定义释义」随时录入专属笔记。`,
      source: '待扩展词库',
      needExtension: true
    };
  }

  /**
   * 朗读发音
   */
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
