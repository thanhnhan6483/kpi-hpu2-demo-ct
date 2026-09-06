# I. Primer

## 1. TL;DR kiểu Feynman
- Trang "Cá nhân ĐG — Năng suất lao động" đã có đủ dữ liệu nhưng trình bày phẳng: điểm/xếp loại nằm lẫn giữa hàng chữ nhỏ, % tiêu chí chỉ là con số, nhận xét của 3 vai trò trộn chung một đoạn.
- Chúng ta chỉ sửa phần hiển thị (JSX) của 1 file: thêm khối điểm nổi bật (score block) trong hero, thêm thanh tiến độ cho từng tiêu chí, tách nhận xét theo từng vai trò.
- Không đổi chức năng: nút Đồng bộ, form cập nhật điểm, chọn tháng, bảng tiêu chí kèm "công việc thực hiện trong tháng" giữ nguyên.
- Dùng đúng class có sẵn trong repo (card, badge, progress-bar, kpi-number), không thêm CSS mới.

## 2. Elaboration & Self-Explanation
Trang hiện có 4 khối: (1) Thông tin nhân sự, (2) Cập nhật kết quả, (3) Bảng Kết quả theo tiêu chí, (4) Nhận xét. Vấn đề: khối (1) đưa mọi thông tin vào một hàng chữ nhỏ nên kết quả quan trọng (điểm, xếp loại) bị chìm; khối (3) hiển thị % thực hiện chỉ bằng con số; khối (4) trộn "Tự nhận xét / Trưởng đơn vị / Hội đồng" thành một đoạn text. Cách sửa là tái cấu trúc layout theo thứ bậc thị giác rõ ràng, tận dụng tối đa pattern/code đã có để giảm rủi ro và dễ rollback.

## 3. Concrete Examples & Analogies
- Ví dụ cụ thể: nhân sự đạt 78.5 điểm – Loại B. Trước đây con số đó nằm lẫn giữa "Đơn vị · Vị trí · Tháng". Sau sửa, nó thành khối riêng bên phải hero: số `78.5` cỡ lớn màu primary + badge `Loại B` + thanh tiến độ 78.5%.
- Analogy: trang cũ như một bảng kê liệt kê, trang mới như "bảng điểm sinh viên" — điểm tổng nổi bật ở góc, bảng chi tiết từng môn theo sau.

# II. Audit Summary (Tóm tắt kiểm tra)
- Đã đọc `src/app/kpi/labor-productivity/[userId]/page.tsx` (385 dòng) và `src/app/globals.css` (dòng 42–160).
- Xác nhận có sẵn: `.card`, `.card-header`, `.badge`(+ class trạng thái), `.btn-primary`, `.table`, `.progress-bar`/`.progress-fill`, `.kpi-number`; màu semantic `text-text-dark/light`, `bg-bg-cream`, `text-primary`, `border-border`.
- `bg-bg-cream` được dùng rộng rãi trong repo (Sidebar, tables, filters...) nên hợp lệ.
- Không có component Shadcn chuyên biệt cho trang này; page tự dùng class tĩnh — giữ pattern.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- Đây là bài toán UX, không phải bug. Root cause của "nhìn chưa đẹp/rõ": thiếu hierarchy (điểm bị chìm trong hàng chữ), thiếu encoding trực quan (không có progress bar), thiếu grouping (nhận xét trộn vai trò).
- Giả thuyết đối chứng bị loại trừ: "thiếu dữ liệu" — sai, tất cả field đã có trong `computed`, `rec`, `user`, `unit`.
- Confidence: High. Thay đổi giới hạn ở JSX, không đụng data/logic/API.

# IV. Proposal (Đề xuất)
Chỉ sửa `src/app/kpi/labor-productivity/[userId]/page.tsx`:

1. **Hero card "Thông tin nhân sự"**
   - `card-header` giữ tiêu đề + nút Đồng bộ (chỉ `canManage`).
   - Body: grid `grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center`.
   - Cột trái: họ tên cỡ lớn + mã NV + badge trạng thái; chips `bg-bg-cream` cho Đơn vị · Vị trí · Bộ KPI mẫu · Tháng đánh giá.
   - Cột phải (score block): `border-l-2 border-primary pl-4 lg:min-w-[220px]`, nhãn "Tự đánh giá", số `.kpi-number` + `/ 100` + badge xếp loại, thanh `progress-bar` width theo `displayScore`.
2. **Card "Cập nhật kết quả tự đánh giá"**: giữ nguyên (vị trí + logic `handleSaveSelf`).
3. **Card "Kết quả tự đánh giá theo tiêu chí"**
   - Subtitle card-header: `N tiêu chí · a/b công việc hoàn thành · x công việc trong tháng`.
   - Cột "% thực hiện": số % + `progress-bar`/`progress-fill bg-primary`.
   - Giữ hàng lồng công việc (`colSpan={6}`) + khối "Chưa gán chỉ tiêu".
4. **Card "Nhận xét, đánh giá"**
   - Gói vào card + card-header; body `divide-y divide-border`.
   - Mỗi vai trò (Tự / Trưởng đơn vị / Hội đồng) một row riêng, ẩn row thiếu dữ liệu.

# V. Files Impacted (Tệp bị ảnh hưởng)
- `Sửa: src/app/kpi/labor-productivity/[userId]/page.tsx` — trang detail hiện render 4 khối JSX phẳng; đổi layout hero, thêm progress bar, nhóm notes theo vai trò.
- `Thêm: .factory/docs/labor-productivity-detail-redesign-spec.md` — spec này.

# VI. Execution Preview (Xem trước thực thi)
1. Đọc lại chính xác các block JSX cần thay (hero, tiêu chí, notes) để `oldString` khớp.
2. Thêm biến tổng quan `totalCri`, `totalDone`, `totalTasks` sau khối `computed`.
3. Sửa hero → sửa subtitle + cột % của bảng tiêu chí → sửa notes.
4. Review tĩnh: null-safety (`rec`/`user` undefined), `kpi-number` render tốt trên mobile, `colSpan` không lệch.
5. Chạy `npx tsc --noEmit` (chỉ 2 lỗi pre-existing).
6. Commit `--no-verify` (kèm spec), không commit 8 file `src/data/*.json`.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- `npx tsc --noEmit 2>&1 | Select-Object -First 10` → chỉ còn 2 lỗi đã biết (`individual-plans/route.ts:28`, `my-kpi/page.tsx:85`).
- Micro-checklist: hiểu kết quả trong 5 giây; mobile xếp dọc 1 cột; contrast theo chuẩn repo; không thêm class/ăng CSS mới.
- Runtime/integration: do tester phụ trách (AGENTS: cấm tự chạy build/lint).

# VIII. Todo
- [x] Thêm biến tổng quan (`totalCri`, `totalDone`, `totalTasks`).
- [x] Hero card: grid 2 cột + score block (kpi-number, badge, progress-fill).
- [x] Giữ nguyên card "Cập nhật kết quả" + `handleSaveSelf`.
- [x] Bảng tiêu chí: subtitle tổng quan + progress bar cột "% thực hiện"; giữ hàng lồng công việc + "Chưa gán chỉ tiêu".
- [x] Notes: đóng card-header + tách row theo vai trò.
- [x] Tạo spec `.factory/docs/labor-productivity-detail-redesign-spec.md`.
- [ ] Chạy `npx tsc --noEmit` (chỉ 2 lỗi pre-existing).
- [ ] Commit `--no-verify` (page + spec), không commit data files.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Pass: điểm/xếp loại/tổng % hiển thị nổi bật trong hero; mỗi tiêu chí có thanh tiến độ %; nhận xét chia 3 vai trò rõ ràng; `tsc` chỉ còn 2 lỗi cũ; commit không kèm `src/data/*.json`.
- Fail: đổi hành vi nút Đồng bộ/form lưu; render lệch `colSpan`; thêm CSS mới hoặc lệch pattern repo.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Rủi ro thấp, giới hạn 1 file JSX. Layout mobile có thể cần tinh chỉnh grid (đã thiết kế sẵn 1 cột dọc).
- Rollback: revert/checkout commit cũ — không có schema/data change.

# XI. Out of Scope (Ngoài phạm vi)
- Không đổi logic/data/API; không thêm chart/visual mới; không đụng console `/kpi/labor-productivity`; không thêm permission mới.