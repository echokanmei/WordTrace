/**
 * 词迹 WordTrace - 艾宾浩斯 / SM-2 记忆曲线算法调度器
 * 根据用户的复习打分（1=重来, 2=困难, 3=良好, 4=简单），计算下次复习时间
 */
class SRSEngine {
  /**
   * 计算更新后的 SRS 状态
   * @param {Object} currentSrs 当前记忆状态
   * @param {number} grade 用户评分 1(Again), 2(Hard), 3(Good), 4(Easy)
   * @returns {Object} 更新后的 SRS 状态
   */
  static calculate(currentSrs, grade) {
    let { repetition = 0, interval = 0, easeFactor = 2.5 } = currentSrs;

    // 评分映射到标准 SM-2 (0-5 scale)
    // 1(Again): 1分; 2(Hard): 2.5分; 3(Good): 4分; 4(Easy): 5分
    const scoreMap = { 1: 1, 2: 2.5, 3: 4, 4: 5 };
    const q = scoreMap[grade] || 3;

    if (grade === 1) {
      // 遗忘：间隔重置为 1 天，重复次数归零
      repetition = 0;
      interval = 1;
    } else {
      // 记住了
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetition += 1;
      if (grade === 4) {
        interval = Math.round(interval * 1.3); // 简单词给予额外间隔奖励
      }
    }

    // 更新难度因子 Ease Factor (最低不小于 1.3)
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    // 计算下次到期时间 (当前时间 + interval * 24小时)
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + interval);

    return {
      wordId: currentSrs.wordId,
      repetition,
      interval,
      easeFactor: Number(easeFactor.toFixed(2)),
      dueDate: nextDate.toISOString(),
      reviewCount: (currentSrs.reviewCount || 0) + 1,
      lastReviewedAt: new Date().toISOString()
    };
  }

  /**
   * 格式化下次复习时间的提示文本
   */
  static formatInterval(interval) {
    if (interval <= 1) return '明天';
    if (interval < 30) return `${interval}天后`;
    if (interval < 365) return `${Math.round(interval / 30)}个月后`;
    return `${(interval / 365).toFixed(1)}年后`;
  }
}

window.srsEngine = SRSEngine;
