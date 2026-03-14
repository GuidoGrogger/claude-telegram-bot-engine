/**
 * Per-chat session store.
 * Maps Telegram chat IDs to Claude session IDs so conversations persist.
 */
class SessionStore {
  constructor() {
    this.sessions = new Map(); // chatId -> { sessionId, totalCost, model, images }
  }

  get(chatId) {
    return this.sessions.get(chatId) || null;
  }

  set(chatId, sessionId, cost = 0) {
    const existing = this.sessions.get(chatId);
    const totalCost = (existing?.totalCost || 0) + cost;
    this.sessions.set(chatId, {
      sessionId,
      totalCost,
      model: existing?.model || null,
      images: existing?.images || [],
    });
  }

  clear(chatId) {
    const existing = this.sessions.get(chatId);
    const images = existing?.images || [];
    this.sessions.delete(chatId);
    return images;
  }

  addImages(chatId, imagePaths) {
    const existing = this.sessions.get(chatId);
    if (existing) {
      existing.images = [...(existing.images || []), ...imagePaths];
    } else {
      this.sessions.set(chatId, {
        sessionId: null,
        totalCost: 0,
        model: null,
        images: [...imagePaths],
      });
    }
  }

  getImages(chatId) {
    return this.sessions.get(chatId)?.images || [];
  }

  getCost(chatId) {
    return this.sessions.get(chatId)?.totalCost || 0;
  }

  getModel(chatId) {
    return this.sessions.get(chatId)?.model || null;
  }

  setModel(chatId, model) {
    const existing = this.sessions.get(chatId);
    if (existing) {
      existing.model = model;
    } else {
      this.sessions.set(chatId, { sessionId: null, totalCost: 0, model });
    }
  }
}

module.exports = new SessionStore();
module.exports.SessionStore = SessionStore;
