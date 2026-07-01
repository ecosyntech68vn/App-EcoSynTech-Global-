// Voice Journal — ghi nhật ký đồng ruộng bằng giọng nói
// Web Speech API: SpeechRecognition (Chrome, Edge, Safari)

let recognition = null;
let isListening = false;

const ACTIVITY_KEYWORDS = {
  'tưới': 'irrigation',
  'tưới nước': 'irrigation',
  'bơm': 'irrigation',
  'phun': 'pest',
  'phun thuốc': 'pest',
  'xịt': 'pest',
  'xịt thuốc': 'pest',
  'thuốc': 'pest',
  'bón': 'fertilizer',
  'bón phân': 'fertilizer',
  'phân': 'fertilizer',
  'cỏ': 'weeding',
  'làm cỏ': 'weeding',
  'nhổ cỏ': 'weeding',
  'cắt': 'weeding',
  'kiểm tra': 'inspection',
  'xem': 'inspection',
  'kiểm định': 'inspection',
  'khác': 'other',
};

const CROP_KEYWORDS = {
  'lúa': 'Lúa',
  'rau muống': 'Rau muống',
  'rau cải': 'Cải',
  'rau': 'Rau',
  'cải': 'Cải',
  'cà chua': 'Cà chua',
  'dưa': 'Dưa',
  'xoài': 'Xoài',
  'ổi': 'Ổi',
  'chuối': 'Chuối',
  'cam': 'Cam',
  'bưởi': 'Bưởi',
  'sầu riêng': 'Sầu riêng',
  'cà phê': 'Cà phê',
  'tiêu': 'Tiêu',
  'hồ tiêu': 'Hồ tiêu',
};

export const voiceStore = {
  isSupported() {
    return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  },

  isListening() {
    return isListening;
  },

  // Parse câu nói thành structured event
  parse(text) {
    const lower = text.toLowerCase();
    const result = {
      type: 'other',
      crop: null,
      material: null,
      dose: null,
      doseUnit: null,
      note: text,
      duration: null,
      area: null,
    };

    // Detect activity type
    for (const [keyword, type] of Object.entries(ACTIVITY_KEYWORDS)) {
      if (lower.includes(keyword)) {
        result.type = type;
        break;
      }
    }

    // Detect crop (ưu tiên từ dài nhất trước, VD: "rau muống" trước "rau")
    const sortedCrops = Object.entries(CROP_KEYWORDS).sort((a, b) => b[0].length - a[0].length);
    for (const [keyword, crop] of sortedCrops) {
      if (lower.includes(keyword)) {
        result.crop = crop;
        break;
      }
    }

    // Extract numbers (dose, duration, area)
    const unitPatterns = [
      { regex: /(\d+[.,]?\d*)\s*(phút)/i, unit: 'phút', isDuration: true },
      { regex: /(\d+[.,]?\d*)\s*(giờ)/i, unit: 'giờ', isDuration: true, multiplier: 60 },
      { regex: /(\d+[.,]?\d*)\s*(h)\b/i, unit: 'h', isDuration: true, multiplier: 60 },
      { regex: /(\d+[.,]?\d*)\s*(ml|kg|g|lít|l)/i, unit: 'ml' },
      { regex: /(\d+[.,]?\d*)\s*(m2|m²|ha|sào)/i, unit: 'm2' },
    ];
    for (const { regex, isDuration, multiplier } of unitPatterns) {
      const m = text.match(regex);
      if (m) {
        const val = parseFloat(m[1].replace(',', '.'));
        if (isDuration) {
          result.duration = multiplier ? val * multiplier : val;
        } else {
          result.dose = String(val);
          result.doseUnit = m[2];
        }
        break;
      }
    }

    // Detect tank mix: "pha 20ml abamectin + 30ml mancozeb"
    if (lower.includes('+') || lower.includes('pha')) {
      const parts = text.split(/[+]/);
      if (parts.length > 1) {
        result.note = text;
      }
    }

    return result;
  },

  // Bắt đầu nghe — trả về Promise<string>
  startListening(lang = 'vi-VN') {
    if (!this.isSupported()) {
      return Promise.reject(new Error('Trình duyệt không hỗ trợ nhận dạng giọng nói'));
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    isListening = true;

    return new Promise((resolve, reject) => {
      recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        isListening = false;
        resolve(transcript.trim());
      };
      recognition.onerror = (e) => {
        isListening = false;
        reject(new Error('Lỗi nhận dạng: ' + e.error));
      };
      recognition.onend = () => {
        isListening = false;
      };
      recognition.start();
    });
  },

  stopListening() {
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
      recognition = null;
    }
    isListening = false;
  }
};
