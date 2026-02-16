const API_ENDPOINT = (window.ENV && window.ENV.API_ENDPOINT) || "";

export class OcrError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "OcrError";
    this.details = details;
  }
}

export const OcrService = {
  async processImage(file) {
    const formData = new FormData();
    formData.append("file", file, file.name);

    const requestTime = new Date().toISOString();
    let response;
    let responseData;

    try {
      response = await fetch(`${API_ENDPOINT}/ocr/jobs`, {
        method: "POST",
        body: formData,
      });

      responseData = await response.json().catch(() => null);
    } catch (networkError) {
      throw new OcrError("ネットワークエラーが発生しました", {
        type: "NETWORK_ERROR",
        timestamp: requestTime,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        error: networkError.message,
      });
    }

    if (!response.ok) {
      throw new OcrError(
        responseData?.error || `HTTPエラー: ${response.status}`,
        {
          type: "HTTP_ERROR",
          timestamp: requestTime,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          httpStatus: response.status,
          httpStatusText: response.statusText,
          response: responseData,
        }
      );
    }

    if (responseData?.status === "FAILED") {
      throw new OcrError(responseData.error || "OCR処理に失敗しました", {
        type: "OCR_FAILED",
        timestamp: requestTime,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        jobId: responseData.job_id,
        response: responseData,
      });
    }

    return {
      text: responseData?.text || "",
    };
  },
};
