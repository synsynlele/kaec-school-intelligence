const BLANK_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKcAD//Z";

export type PdfBranding = {
  logoJpegBase64: string;
  hasSchoolLogo: boolean;
};

export const KSI_PDF_ATTRIBUTION = "Powered by KSI | by KAEC-NG";

export function resolvePdfBranding(logoUrl: string | null | undefined): PdfBranding {
  const value = logoUrl?.trim() ?? "";
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(value);

  if (match?.[1] && match[1].length <= 900_000) {
    return {
      logoJpegBase64: match[1],
      hasSchoolLogo: true,
    };
  }

  return {
    logoJpegBase64: BLANK_JPEG_BASE64,
    hasSchoolLogo: false,
  };
}
