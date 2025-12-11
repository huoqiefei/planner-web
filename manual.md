# Planner Web - User Operation Manual

## 1. Getting Started
Welcome to **Planner Web**, a professional CPM scheduling tool.
To begin:
- Click **"Create New Project"** on the landing page.
- Or select **"File > New"** from the top menu.
- You can also open existing projects (`.json`) using **"File > Import"**.

## 2. Project Setup
Before adding tasks:
- Go to **Project > Project Information**.
- Set the **Project Start Date** and **Project Code**.
- In the **Defaults** tab, set auto-numbering rules for Activities and Resources.
- In the **Calendars** tab, define working days and holidays.

## 3. WBS & Activities
Build your schedule hierarchy in the **Activities** view:
- **Add WBS:** Right-click on a row or use the context menu to add a Child WBS.
- **Add Activity:** Right-click a WBS or Activity to add a new task.
- **Edit:** Double-click any cell (Name, Duration, Start Date) to edit directly.
- **Hierarchy:** Use the WBS structure to organize tasks.
- **Delete:** Select a row and press the **Delete** key.

## 4. Logic & Scheduling
The system uses the **Critical Path Method (CPM)**:
- **Predecessors:** Type into the "Predecessors" column (e.g., `A100`, `A100SS+5`).
- **Details Panel:** Use the **Relationships** tab to add Predecessors or Successors.
- **Logic Lines:** Toggle the Logic Lines icon in the toolbar to visualize connections.
- **Critical Path:** Toggle the Critical Path icon to highlight critical tasks in red.

## 5. Resources
Manage labor, material, and equipment:
- **Define:** Go to the **Resources** view to add resources and set limits.
- **Assign:** In Activities view, use the **Details Panel > Resources** tab.
- **Batch Assign:** Select multiple activities, right-click, and choose "Assign Resource".
- **Analysis:** View the Resource Histogram to check for over-allocation.

## 6. Printing
- Go to **File > Print Preview**.
- Select **Paper Size** (A4, A3, A2, A1) and **Orientation**.
- Select which **Columns** to include in the table.
- Click **Print Preview** to generate a PDF. The system will auto-scale the timeline to fit the page width.