import { beforeEach, describe, expect, it, vi } from "vitest";
import { uploadImage, publicUrl } from "./uploadClient";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  fileUpload: vi.fn()
}));

vi.mock("./apiClient", () => ({
  apiRequest: mocks.apiRequest,
  getR2PublicBase: () => "https://r2.example"
}));

vi.mock("expo-file-system", () => ({
  File: class FakeFile {
    readonly size = 1234;

    constructor(readonly uri: string) {}

    upload(url: string, options: unknown) {
      return mocks.fileUpload(url, options, this.uri);
    }
  },
  UploadType: { BINARY_CONTENT: 0, MULTIPART: 1 }
}));

describe("uploadImage", () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.fileUpload.mockReset();
  });

  it("使用原生文件上传直传 R2，避免 Blob 转换", async () => {
    mocks.apiRequest.mockResolvedValue({
      key: "avatars/account/avatar.jpg",
      uploadUrl: "https://r2-upload.example/avatar.jpg",
      fields: { key: "avatars/account/avatar.jpg", policy: "signed-policy" }
    });
    mocks.fileUpload.mockResolvedValue({ status: 200, body: "", headers: {} });

    const key = await uploadImage("avatar", { uri: "file:///tmp/avatar.jpg", mime: "image/jpeg" });

    expect(key).toBe("avatars/account/avatar.jpg");
    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/uploads/presign", {
      method: "POST",
      body: { kind: "avatar", contentType: "image/jpeg", sizeBytes: 1234 }
    });
    expect(mocks.fileUpload).toHaveBeenCalledWith(
      "https://r2-upload.example/avatar.jpg",
      {
        httpMethod: "POST",
        uploadType: 1,
        fieldName: "file",
        mimeType: "image/jpeg",
        parameters: { key: "avatars/account/avatar.jpg", policy: "signed-policy" }
      },
      "file:///tmp/avatar.jpg"
    );
  });

  it("R2 返回非 2xx 时抛出上传失败", async () => {
    mocks.apiRequest.mockResolvedValue({
      key: "avatars/account/avatar.jpg",
      uploadUrl: "https://r2-upload.example/avatar.jpg",
      fields: {}
    });
    mocks.fileUpload.mockResolvedValue({ status: 403, body: "", headers: {} });

    await expect(uploadImage("avatar", { uri: "file:///tmp/avatar.jpg", mime: "image/jpeg" })).rejects.toThrow(
      "图片上传失败（403）"
    );
  });

  it("上传自定义勋章时提交文件大小", async () => {
    mocks.apiRequest.mockResolvedValue({
      key: "adventures/space-1/badge.png",
      uploadUrl: "https://r2-upload.example/badge.png",
      fields: {}
    });
    mocks.fileUpload.mockResolvedValue({ status: 200, body: "", headers: {} });

    await uploadImage("adventure", {
      uri: "file:///tmp/badge.png",
      mime: "image/png",
      sizeBytes: 320_000
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/uploads/presign", {
      method: "POST",
      body: {
        kind: "adventure",
        contentType: "image/png",
        sizeBytes: 320_000
      }
    });
  });
});

describe("publicUrl", () => {
  it("用 R2 公开域名拼对象地址", () => {
    expect(publicUrl("avatars/account/avatar.jpg")).toBe("https://r2.example/avatars/account/avatar.jpg");
    expect(publicUrl(null)).toBeNull();
  });
});
