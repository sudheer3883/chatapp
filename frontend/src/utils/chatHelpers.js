/**
 * Safely extracts string ID from either Mongoose document, plain object, or ID string
 */
export const getEntityId = (entity) => {
  if (!entity) return '';
  if (typeof entity === 'string') return entity;
  return (entity._id || entity.id || '').toString();
};

/**
 * Returns the OTHER participant in a 1-on-1 conversation
 */
export const getPartner = (conversation, currentUser) => {
  if (!conversation || !conversation.participants || conversation.participants.length === 0) {
    return null;
  }
  const myId = getEntityId(currentUser);
  const other = conversation.participants.find((p) => getEntityId(p) !== myId);
  return other || null;
};
