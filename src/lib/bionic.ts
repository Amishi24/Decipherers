export function toBionic(text: string): string {
  if (!text) return "";

  // Split text by spaces to process each word
  return text.split(/\s+/).map((word) => {
    // Sanitize basic HTML to prevent injection (optional but safe)
    const cleanWord = word.replace(/<[^>]*>/g, ""); 
    
    const length = cleanWord.length;
    let boldLength = 0;

    // Determine how many characters to bold based on word length
    if (length <= 3) {
        boldLength = length; // Bold the whole short word
    } else if (length <= 6) {
        boldLength = Math.ceil(length * 0.6); // Bold ~60%
    } else {
        boldLength = Math.ceil(length * 0.4); // Bold ~40% for long words
    }

    // Wrap the start of the word in <b> tags
    const boldPart = cleanWord.slice(0, boldLength);
    const normalPart = cleanWord.slice(boldLength);

    return `<b>${boldPart}</b>${normalPart}`;
  }).join(" ");
}