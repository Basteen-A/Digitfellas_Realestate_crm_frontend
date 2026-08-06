// Shared file-type helpers for document lists / uploaders.
// Mirrors the logic used in CollectionBookingDetail so every document UI
// (Record Manager, project archive, collection) looks and behaves the same.
import {
  PaperClipIcon, PhotoIcon, DocumentTextIcon, FilmIcon, MusicalNoteIcon,
  DocumentIcon, TableCellsIcon, PresentationChartBarIcon, ArchiveBoxIcon,
} from '@heroicons/react/24/outline';

// `Icon` is the heroicon *component* for the file type - render it as
// `<meta.Icon style={{ width: 16, height: 16 }} />`, not as `{meta.Icon}`.
export const getFileMeta = (mimeType = '', fileName = '') => {
  const mt = String(mimeType).toLowerCase();
  const name = String(fileName).toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  const isImage = mt.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  const isPdf = mt === 'application/pdf' || ext === 'pdf';
  const isVideo = mt.startsWith('video/') || ['mp4', 'mov', 'webm', 'avi'].includes(ext);
  const isAudio = mt.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext);
  const isDoc = ['doc', 'docx', 'odt', 'rtf'].includes(ext) || mt.includes('msword') || mt.includes('officedocument.wordprocessing');
  const isSheet = ['xls', 'xlsx', 'csv', 'ods'].includes(ext) || mt.includes('spreadsheet') || mt.includes('excel');
  const isSlide = ['ppt', 'pptx', 'odp'].includes(ext) || mt.includes('presentation') || mt.includes('powerpoint');
  const isZip = ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mt.includes('zip') || mt.includes('compressed');
  const isText = mt.startsWith('text/') || ['txt', 'md', 'json', 'xml', 'log'].includes(ext);
  let Icon = PaperClipIcon;
  if (isImage) Icon = PhotoIcon;
  else if (isPdf) Icon = DocumentTextIcon;
  else if (isVideo) Icon = FilmIcon;
  else if (isAudio) Icon = MusicalNoteIcon;
  else if (isDoc) Icon = DocumentIcon;
  else if (isSheet) Icon = TableCellsIcon;
  else if (isSlide) Icon = PresentationChartBarIcon;
  else if (isZip) Icon = ArchiveBoxIcon;
  else if (isText) Icon = DocumentTextIcon;
  return { Icon, isImage, isPdf, ext };
};

export const humanFileSize = (bytes) => {
  if (!bytes) return '-';
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};
