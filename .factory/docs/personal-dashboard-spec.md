# I. Primer

## 1. TL;DR kiểu Feynman
- Trang `/kpi/personal-dashboard` đã tồn tại từ trước nhưng đang hiển thị dữ liệu **demo tĩnh** (lấy `slice(0, 20)` chung chung), không theo user đăng nhập, và chưa có trong menu.
- Task này **nâng cấp trang đó** thành dashboard cá nhân thật: chỉ hiển thị dữ liệu của **chính user đang đăng nhập** (qua `useSession`).
- Theo quyết định của user, trang hiển thị 4 khối: **Chỉ tiêu KPI cá nhân**, **Năng suất lao động tháng**, **Công việc của tôi** (trong tháng), **Cảnh báo & nhắc nhở**.
- Trang có **bộ chọn tháng** để xem công việc + năng suất theo từng tháng; KPI cá nhân theo chu kỳ (không phụ thuộc tháng).
- Trang được thêm vào menu Sidebar nhóm **Dashboard** (cạnh "Dashboard đơn vị"), ai đăng nhập cũng vào được (chỉ hiển thị dữ liệu của chính mình, không cần phân quyền xem người khác).

## 2. Elaboration & Self-Explanation
Trước đây trang dashboard cá nhân:
- Import thẳng các file JSON tĩnh (`plan-items.json`, `plans.json`, `scores.json`, `progress.json`, ...) và tự bốc `activePlanItems.slice(0, 20)` — tức **"KPI của tôi" không phải của ai cụ thể**, là lấy đại danh sách chung.
- Có 3 tab role (Cá nhân / Bộ môn / Đơn vị), widget tùy chỉnh lưu localStorage, nút "Xuất báo cáo" trỏ tới `/api/reports/export?type=personal-dashboard` — mà endpoint này **chỉ hỗ trợ** `unit|individual|reward`, nên nút bấm sẽ nhận 400 (Invalid type).

Sau khi nâng cấp:
- Dũ**rõ thực thể**: mọi số liệu gốc từ user đăng nhập `session.user.id` và 3 module nghiệp vụ thật:
  - KPI cá nhân → `/api/individual-plans?userId=<me>`;
  - Công việc tháng → `/api/unit-work-plans?primaryUserId=<me>` (lọc theo `month`);
  - Năng suất tháng → `/api/labor-productivity?userId=<me>&month=<m>&academicYearId=<ay>`.
- Giữ chuẩn UI hiện có của repo: `.card`, `.card-header`, `.badge`, `.kpi-number`, `.progress-bar/.progress-fill`, `table`, các badge meta từ `src/lib/laborProductivity.ts` (`GRADE_META`, `PRODUCTIVITY_STATUS_META`, `finalScoreOf`, `finalGradeOf`).
- "Năng suất tháng" dùng `finalScoreOf`/`finalGradeOf` để lấy điểm/xếp loại cuối (đã tính thêm đánh giá của quản lý + hội đồng nếu có), kèm link đi sâu vào `/kpi/labor-productivity/<me>?month=...`.

## 3. Concrete Examples & Analogies
Ví dụ: user u003 Trần Thu Hà đăng nhập.
1. Mở **Dashboard cá nhân** trong menu → trang lấy KPI của u003, các công việc nơi `primaryUserId = u003` (tháng đang chọn), và bản ghi năng suất tháng của u003 (nếu có).
2. KPI chưa đăng ký → khối "Chỉ tiêu KPI cá nhân" hiển thị empty state và nút "Tạo kế hoạch KPI" trỏ `/kpi/my-kpi`.
3. Chưa tự đánh giá tháng → khối năng suất hiện trạng thái trống + nút "Tự đánh giá" mở màn Cá nhân ĐG; **Cảnh báo & nhắc nhở** nhắc "Chưa tự đánh giá năng suất tháng ...".
4. Có việc quá hạn → badge "Quá hạn" tăng + cảnh báo đỏ liệt kê số việc.

Analogy: đây giống màn hình "Thông tin của tôi" trên app nhân viên — chỉ thấy giấy tờ của mình, không thấy giấy tờ của đồng nghiệp; bấm vào từng mục sẽ nhảy đúng tới form của mình.

# II. Audit Summary (Tóm tắt kiểm tra)
- Observation: `/kpi/personal-dashboard` exist nhưng **data tĩnh không theo user** (`planItemsData`, `activePlanItems.slice(0, 20)` — evidence `page.tsx` cũ dòng 6–15, 81), nút "Xuất báo cáo" gọi type không được hỗ trợ → 400 (`reports/export/route.ts` chỉ xử lý `unit|individual|reward`, evidence dòng 21–122), không có menu entry (evidence `Sidebar.tsx` dòng 36–40 chỉ có unit-dashboard).
- Data khảo sát API: `individual-plans` hỗ trợ GET `userId`; `unit-work-plans` hỗ trợ `primaryUserId`; `labor-productivity` hỗ trợ `userId+month+academicYearId` — **tất cả đã có sẵn server-side**, không cần API/schema mới.
- UI chuẩn đã có sẵn trong `src/lib/laborProductivity.ts` (`GRADE_META`, `PRODUCTIVITY_STATUS_META`, `finalScoreOf`, `finalGradeOf`, `currentMonthKey`, `yearMonths`) và class CSS `.card/.kpi-number/...` — tận dụng thay vì tạo mới.
- Phạm vi ảnh hưởng: chỉ 1 trang + 1 menu entry; không đổi API, không đổi schema, không đổi `src/data`.

# III. Root Cause & Counter-Hypothesis (Nguyên nhân gốc & Giả thuyết đối chứng)
- Root cause: trang dashboard cá nhân cũ được xây dựng trước khi có các module nghiệp vụ thật (individual-plans, labor-productivity, unit-work-plans), nên phụ thuộc dữ liệu tĩnh demo và không gắn với session user.
- Counter-hypothesis bị loại trừ:
  - "Phải tạo route mới `/kpi/my-dashboard`" → Loại: `/kpi/personal-dashboard` đã đúng tên, nâng cấp tại chỗ tránh 2 trang trùng (user đã chọn option này).
  - "Phải cho phép xem nhân sự khác (`?userId=`)" → Loại: user chọn **chỉ hiển thị user đăng nhập**.
  - "Cần widget customize / tab Bộ môn–Đơn vị / Xuất báo cáo" → Loại: không cần thiết cho mục tiêu, nút export gốc vốn lỗi 400.

# IV. Proposal (Đề xuất)
1. Viết lại `src/app/kpi/personal-dashboard/page.tsx`:
   - Dùng `useSession()`; nếu `authStatus === 'loading'` hiển thị loader.
   - Load song song (Promise.all) 4 nguồn dữ liệu theo user: individual-plans, unit-work-plans, labor-productivity, units (để tên đơn vị).
   - State `month` (mặc định `currentMonthKey()`), selector tháng từ `yearMonths(activeYear?.startDate)`.
   - Tính toán:
     - `myPlan` = plan mới nhất theo `createdAt`; `kpiItems = myPlan?.items || []`.
     - `monthTasks` = tasks có `!t.month || t.month === month`; `doneTasks` = `status==='done' || progress>=100`.
     - `overdueTasks` / `upcomingTasks` (≤14 ngày) dựa trên `dueDate` dạng `dd/MM/yyyy`.
     - `score = finalScoreOf(rec)`, `grade = finalGradeOf(rec)`, `statusMeta = PRODUCTIVITY_STATUS_META[rec.status]`.
   - UI 4 khối: header (+tháng), 4 stat cards, khối KPI + năng suất (`lg:grid-cols-3`), khối công việc + cảnh báo (`lg:grid-cols-2`).
   - Xóa toàn bộ import JSON tĩnh cũ, role tabs, widget customize, nút "Xuất báo cáo" lỗi.
2. Thêm menu `children: Dashboard cá nhân` vào nhóm Dashboard trong `Sidebar.tsx`.
3. Không đổi API/schema/data; `IndividualPlan.items` truy cập qua type local `IndividualPlanWithItems` để không thêm lỗi TS mới (type gốc chưa khai `items`).

# V. Files Impacted (Tệp bị ảnh hưởng)
- `Sửa:` `src/app/kpi/personal-dashboard/page.tsx` — vai trò: trang dashboard cá nhân hiện tại (data tĩnh); đổi thành: dashboard theo user đăng nhập với 4 khối nội dung thật + selector tháng.
- `Sửa:` `src/components/layout/Sidebar.tsx` — vai trò: menu điều hướng; thêm entry "Dashboard cá nhân" vào nhóm Dashboard.
- `Thêm:` `.factory/docs/personal-dashboard-spec.md` — spec của task này.

# VI. Execution Preview (Xem trước thực thi)
1. Đọc hiện trạng trang + các API route + type dữ liệu (individual-plans, unit-work-plans, labor-productivity, cycles, units, laborProductivity lib).
2. Viết lại trang theo 4 khối đã chốt; xóa import tĩnh cũ.
3. Thêm menu entry vào Sidebar.
4. Verify: `npx tsc --noEmit` chỉ còn 2 lỗi pre-existing (`IndividualPlan.items` ở `individual-plans/route.ts:28` và `my-kpi/page.tsx:85`).
5. Ghi spec `.factory/docs/personal-dashboard-spec.md` và commit.

# VII. Verification Plan (Kế hoạch kiểm chứng)
- Typecheck: `npx tsc --noEmit 2>&1 | Select-Object -First 10` — chỉ còn đúng 2 lỗi pre-existing đã biết.
- Grep: `personal-dashboard/page.tsx` không còn import `plan-items.json|plans.json|scores.json|progress.json|evidences.json|individual-evaluations.json|cycles.json` và không còn nhãn "Xuất báo cáo"/"Tùy chỉnh".
- Integration (tester phụ trách, theo AGENTS.md):
  - Đăng nhập 1 staff → mở Dashboard cá nhân → dữ liệu đúng của chính user (KPI của user, việc `primaryUserId=user`, năng suất tháng của user).
  - Đổi tháng → công việc + năng suất cập nhật theo tháng; KPI giữ nguyên.
  - User chưa có KPI → empty state + nút "Tạo kế hoạch KPI" hoạt động.
  - User chưa tự đánh giá → cảnh báo "Chưa tự đánh giá" + nút "Tự đánh giá" mở `/kpi/labor-productivity/<me>?month=...`.

# VIII. Todo
- [x] Khảo sát trang cũ + API hỗ trợ filter theo user.
- [x] Hỏi user chốt scope (nâng cấp tại chỗ, chỉ user đăng nhập, 4 khối nội dung).
- [x] Viết lại `personal-dashboard/page.tsx` theo dữ liệu thật + selector tháng.
- [x] Thêm menu "Dashboard cá nhân" vào Sidebar.
- [x] Verify tsc sạch (chỉ 2 lỗi pre-existing).
- [x] Ghi spec `.factory/docs/personal-dashboard-spec.md`.

# IX. Acceptance Criteria (Tiêu chí chấp nhận)
- Dashboard cá nhân hiển thị dữ liệu của **đúng user đăng nhập**: từng con số truy vấn qua API gắn `userId`.
- Đủ 4 khối: Chỉ tiêu KPI cá nhân · Năng suất lao động tháng · Công việc của tôi · Cảnh báo & nhắc nhở.
- Có selector tháng; công việc + năng suất phản ứng theo tháng được chọn.
- Empty state đúng cho: chưa có KPI, chưa tự đánh giá, không có công việc, không có cảnh báo.
- Menu Sidebar hiển thị "Dashboard cá nhân" và mở đúng trang.
- `npx tsc --noEmit` không xuất hiện lỗi mới ngoài 2 lỗi pre-existing.

# X. Risk / Rollback (Rủi ro / Hoàn tác)
- Risk: `individual-plans.json` hiện `[]` → khối KPI hiển thị 0 + empty state (đúng, không phải lỗi); khi data được tạo (qua `/kpi/my-kpi`) thì dashboard tự cập nhật.
- Risk: `dueDate` không có hoặc sai định dạng trên vài bản ghi → công việc đó không tính quá hạn/sắp hạn (an toàn, không crash).
- Risk: session chưa có `unitId` → tên đơn vị hiển thị "—" (không chặn các khối khác).
- Rollback: revert commit — trang cũ hoạt động như trước (file cũ được Git lưu đầy đủ).

# XI. Out of Scope (Ngoài phạm vi)
- Không đổi schema/API/`src/data`.
- Không làm tính năng xem dashboard của nhân sự khác (đã loại ở tầng quyết định).
- Không thêm widget customize, tab Bộ môn/Đơn vị, hay biểu đồ (recharts).
- Không sửa endpoint `/api/reports/export` (chỉ bỏ nút đang trỏ sai).