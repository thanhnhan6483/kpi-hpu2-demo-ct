# Danh mục Vị trí việc làm + gắn Bộ KPI mẫu

# I. Primer
## 1. TL;DR kiểu Feynman
- Mô-đun "Vị trí việc làm" đã có sẵn (`/admin/job-positions`, CRUD 9 vị trí, mỗi vị trí đang gắn 1 nhóm KPI lĩnh vực).
- Bổ sung trường **Bộ KPI mẫu** (`kpiTemplateId`) để mỗi vị trí trỏ tới 1 KPI Template cấp cá nhân lấy từ module `kpi-templates` sẵn có.
- Thêm ô tìm kiếm theo tên/mã; hiển thị cột Bộ KPI mẫu kèm trạng thái template.
- API POST/PUT được whitelist + validate (không nhận field lạ, chặn trùng code, enum status) — an toàn cho nhiều người dùng nhập.
- Gắn menu truy cập: Quản trị → Danh mục → "Vị trí việc làm".
- Không đụng my-kpi / user ↔ vị trí (ngoài phạm vi v1).

## 2. Elaboration & Self-Explanation
Vị trí việc làm (Chuyên viên, Giảng viên, Nghiên cứu viên…) là danh mục nhân sự. Danh mục này cần đủ thông tin để phục vụ việc "xây dựng bộ KPI mẫu cho viên chức - người lao động": biết vị trí đó thuộc nhóm/lĩnh vực KPI nào (có sẵn `kpiGroupId`), và vị trí đó áp dụng bộ KPI mẫu nào. Bộ KPI mẫu cấp cá nhân đã tồn tại ở `kpi-templates.json` (tpl002 "Giảng viên", tpl007 "Chuyên viên") nên chỉ cần nối thêm field `kpiTemplateId` vào mỗi vị trí, không tạo hệ dữ liệu mới.
Trang cũ không có trong menu nên chưa truy cập được từ UI; API nhận mọi field (spread `...body`) — dễ bị dữ liệu lỗi, cần validate nhẹ.

## 3. Concrete Examples & Analogies
- Ví dụ: `jp002` "Giảng viên" (nhóm `grp_dt`) → thêm `kpiTemplateId: "tpl002"` = "Bộ KPI mẫu Giảng viên" (Đang dùng). `jp001` "Chuyên viên" → `tpl007` "Bộ KPI mẫu Chuyên viên" (Nháp).
- Analogy: như phiếu mô tả công việc — dòng "thuộc khối nào" (Nhóm KPI) để quản lý hành chính, "bộ tiêu chí đánh giá áp dụng" (Bộ KPI mẫu) để khối nhân sự dùng khi đánh giá.

# II. Audit Summary (Tóm tắt kiểm tra)
- `/admin/job-positions/page.tsx`: CRUD hoàn chỉnh, có dropdown Nhóm KPI chính từ `kpi-groups.json` tĩnh; thiếu Bộ KPI mẫu, thiếu tìm kiếm.
- `/api/job-positions/route.ts` (POST): không validate name/code, không check trùng code, không nhận `kpiTemplateId`.
- `/api/job-positions/[id]/route.ts` (PUT): `{ ...items[index], ...body }` — nhận mọi field, không validate.
- `job-positions.json`: 9 record, chưa có `kpiTemplateId`.
- `kpi-templates.json`: có 2 template `targetLevel=individual` (tpl002 active, tpl007 draft) — nguồn dropdown.
- `Sidebar.tsx` Quản trị → Danh mục: 7 mục, thiếu "Vị trí việc làm".
- `types/index.ts` `JobPosition` (line 562): thiếu field mới.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- Đây là tính năng mở rộng: nguyên nhân "thiếu sẵn sàng" — trang chưa đủ trường Bộ KPI mẫu, chưa vào menu, API lỏng.
- Counter-hypothesis "chỉ cần thêm menu là xong": loại trừ vì thiếu trường `kpiTemplateId` (yêu cầu chính).
- Confidence: High — đọc trực tiếp 5 file; `/api/job-positions` chỉ được gọi từ trang này.

# IV. Proposal (Đề xuất)
1. Thêm `kpiTemplateId?: string` vào `JobPosition` (types + 9 record JSON, map theo tên vị trí ↔ tên template).
2. Trang admin: fetch `/api/kpi-templates` lọc `targetLevel=individual` → dropdown Bộ KPI mẫu; thêm cột + ô tìm kiếm client-side.
3. API POST/PUT: nhận `kpiTemplateId`; validate name/code bắt buộc, trùng code → 409, status enum; PUT whitelist field.
4. Sidebar: thêm "Vị trí việc làm" vào Quản trị → Danh mục (sau "Danh mục Lĩnh vực KPI").

Seed mapping: GV/GVQL → tpl002; CV/CVCNTT/CVDBCL/CVHTQT → tpl007; NCV/KTV/NV → để trống (chưa có template phù hợp, hiển thị "–").

# V. Files Impacted (Tệp bị ảnh hưởng)
**UI**
- `Sửa:` `src/app/admin/job-positions/page.tsx` — thêm cột/dropdown Bộ KPI mẫu, tìm kiếm, fetch templates.
- `Sửa:` `src/components/layout/Sidebar.tsx` — thêm mục menu "Vị trí việc làm".

**Server / API**
- `Sửa:` `src/app/api/job-positions/route.ts` — nhận `kpiTemplateId`, validate POST.
- `Sửa:` `src/app/api/job-positions/[id]/route.ts` — whitelist + validate PUT.

**Schema / shared**
- `Sửa:` `src/types/index.ts` — thêm `kpiTemplateId?: string`.
- `Sửa:` `src/data/job-positions.json` — seed `kpiTemplateId` (6/9 record).
- `Thêm:` `.factory/docs/vi-tri-viec-lam-kpi-templates.md` — spec này.

# VI. Execution Preview (Xem trước thực thi)
1. Đọc lại 2 route + trang admin để bám pattern (`readDb`, `generateId`, `Modal`, `btn-primary`).
2. Sửa types → 2 route API (validate + whitelist).
3. Seed `job-positions.json`.
4. Sửa trang admin (fetch templates, dropdown, search, cột).
5. Sửa Sidebar (thêm menu).
6. Review tĩnh: typing, empty search, template draft vẫn hiển thị, data cũ thiếu `kpiTemplateId` hiện "–".

# VII. Verification Plan (Kế hoạch kiểm chứng)
- `npx tsc --noEmit 2>&1 | Select-Object -First 20` → chỉ còn 2 lỗi có sẵn (`individual-plans/route.ts` TS2353, `my-kpi/page.tsx` TS2339).
- Không chạy lint/build (theo AGENTS). Runtime do tester verify.

# VIII. Todo
1. `types/index.ts`: thêm `kpiTemplateId?: string` ✔
2. `api/job-positions/route.ts`: + `kpiTemplateId`, validate POST ✔
3. `api/job-positions/[id]/route.ts`: whitelist + validate PUT ✔
4. `data/job-positions.json`: seed `kpiTemplateId` ✔
5. `admin/job-positions/page.tsx`: dropdown + search + cột ✔
6. `Sidebar.tsx`: thêm menu ✔
7. tsc + commit + spec ✔

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Sidebar Quản trị → Danh mục có "Vị trí việc làm", mở được trang (9 vị trí).
- Cột "Bộ KPI mẫu" hiện đúng tên template; vị trí chưa gắn hiện "–".
- Form có dropdown Bộ KPI mẫu (chỉ template cấp cá nhân); lưu xong load lại thấy cập nhật.
- Tìm kiếm lọc theo tên/mã; không crash khi trống kết quả.
- Tạo/sửa code trùng → 409; tên/mã trống → 400.
- tsc chỉ còn 2 lỗi cũ.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- `kpiTemplateId` optional → dữ liệu cũ tương thích. Validate mới có thể chặn thao tác lỏng trước đây (đúng hướng).
- Rollback: `git revert` commit.

# XI. Out of Scope (Ngoài phạm vi)
- Tích hợp my-kpi / tự đề xuất Bộ KPI mẫu khi tạo kế hoạch cá nhân.
- Gắn `user.positionId` sang danh mục vị trí việc làm.
- Tạo mới KPI template; chỉ chọn từ nguồn có sẵn.
- Danh mục chức danh (`positions`), nhóm KPI (`kpi-groups`).