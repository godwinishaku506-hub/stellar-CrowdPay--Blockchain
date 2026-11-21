export function shareOnX(message) {
  const text = encodeURIComponent(message);
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer');
}
