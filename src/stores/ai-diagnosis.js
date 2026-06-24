// AI Plant Diagnosis — TensorFlow Lite integration structure
// Real implementation requires loading .tflite model file
// Currently provides mock diagnosis + structure for future TFLite integration

const MODEL_KEY = 'ai:pest_model_loaded';
const DIAGNOSIS_CACHE = 'ai:diagnosis_cache';

const MOCK_DIAGNOSES = [
  { disease: 'Bệnh đốm lá (Leaf Spot)', confidence: 0.87, treatment: 'Phun Mancozeb 80WP nồng độ 0.2-0.3%, 7 ngày/lần', organic: 'Dung dịch tỏi ớt pha loãng 1:10 phun 5 ngày/lần' },
  { disease: 'Rầy nâu (Brown Planthopper)', confidence: 0.92, treatment: 'Phun Abamectin 3.6EC 0.5L/ha, phun ướt đều gốc', organic: 'Dầu Neem 1L/ha pha 400L nước, phun sáng sớm' },
  { disease: 'Bệnh phấn trắng (Powdery Mildew)', confidence: 0.81, treatment: 'Sulfur 80WG 0.3-0.5kg/ha, phun 7-10 ngày/lần', organic: 'Sữa tươi pha loãng 1:9 với nước, phun 3-4 ngày/lần' },
  { disease: 'Sâu đục thân (Stem Borer)', confidence: 0.78, treatment: 'Emamectin benzoate 5WG 0.3kg/ha, phun khi sâu non', organic: 'Bacillus thuringiensis (Bt) 1L/ha pha 400L nước' },
  { disease: 'Thối rễ (Root Rot)', confidence: 0.73, treatment: 'Cắt bỏ rễ thối, xử lý đất với vôi bột 200kg/ha', organic: 'Trichoderma spp. 5kg/ha trộn với phân chuồng hoai' },
  { disease: 'Nhện đỏ (Red Spider Mite)', confidence: 0.85, treatment: 'Abamectin 3.6EC 0.4L/ha, phun kỹ mặt dưới lá', organic: 'Dầu khoáng 1:100 pha nước, phun 5-7 ngày/lần' },
  { disease: 'Bệnh héo xanh (Bacterial Wilt)', confidence: 0.69, treatment: 'Nhổ bỏ cây bệnh, xử lý đất với chloramphenicol 0.1%', organic: 'Ủ đất với phân xanh + Trichoderma 14 ngày trước vụ sau' },
  { disease: 'Không phát hiện bệnh', confidence: 0.95, treatment: '', organic: '' }
];

export const aiDiagnosisStore = {
  async diagnose(photoBase64) {
    const result = MOCK_DIAGNOSES[Math.floor(Math.random() * MOCK_DIAGNOSES.length)];
    return {
      ...result,
      healthy: result.disease === 'Không phát hiện bệnh' || result.disease === 'Healthy',
      method: 'TensorFlow Lite (mock)',
      timestamp: new Date().toISOString(),
      advisories: result.treatment ? [
        { type: 'chemical', text: result.treatment },
        { type: 'organic', text: result.organic }
      ] : []
    };
  },

  async diagnoseBatch(photos) {
    return Promise.all(photos.map(p => this.diagnose(p)));
  },

  getSupportedDiseases() {
    return MOCK_DIAGNOSES.map(d => d.disease);
  },

  isModelLoaded() {
    try { return !!sessionStorage.getItem(MODEL_KEY); } catch { return false; }
  },

  async loadModel() {
    try { sessionStorage.setItem(MODEL_KEY, '1'); return true; } catch { return false; }
  }
};
