<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

trait PlannerAuth_Traits_ProjectTrait
{
    /**
     * List user projects
     */
    private function projectList()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $projects = $this->db->fetchAll($this->db->select()
            ->from($this->prefix . 'planner_projects')
            ->where('uid = ?', $user['uid'])
            ->order('updated_at', Typecho_Db::SORT_DESC));

        $this->sendResponse(['projects' => $projects]);
    }

    /**
     * Save/Upload Project
     */
    private function projectSave()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        $name = isset($data['name']) ? $data['name'] : 'Untitled Project';
        $description = isset($data['description']) ? $data['description'] : '';
        $content = isset($data['content']) ? $data['content'] : [];
        $projectId = isset($data['id']) ? intval($data['id']) : null;

        if (empty($content)) {
            $this->sendError('Project content is empty', 400);
            return;
        }

        // Check Limits for NEW projects
        if (!$projectId) {
            // Determine Role
            $meta = $this->getUserMeta($user['uid']);
            $plannerRole = isset($meta['planner_role']) ? $meta['planner_role'] : 'trial';
            $group = $user['group'];
            
            // Force/Auto-map based on Group
            if ($group === 'administrator') {
                $plannerRole = 'admin';
            } else if ($group === 'editor') {
                $plannerRole = 'premium';
            } else if ($group === 'contributor') {
                $plannerRole = 'licensed';
            } else if ($group === 'subscriber') {
                 if (!isset($meta['planner_role'])) $plannerRole = 'trial';
            }

            $limit = 1; // Default Trial
            if ($plannerRole === 'licensed') $limit = 3;
            if ($plannerRole === 'premium') $limit = 20;
            if ($plannerRole === 'admin') $limit = 9999;

            $count = $this->db->fetchObject($this->db->select(['COUNT(id)' => 'num'])
                ->from($this->prefix . 'planner_projects')
                ->where('uid = ?', $user['uid']))->num;

            if ($count >= $limit) {
                $this->sendError("Project limit reached for your account type ({$plannerRole}). Limit: {$limit}", 403);
                return;
            }
        }

        $uploadDir = __TYPECHO_ROOT_DIR__ . '/usr/uploads/planner_projects/';
        if (!is_dir($uploadDir)) {
            if (!mkdir($uploadDir, 0755, true)) {
                $this->sendError('Failed to create upload directory', 500);
                return;
            }
        }

        $fileName = $user['uid'] . '_' . time() . '_' . uniqid() . '.json';
        $filePath = $uploadDir . $fileName;

        if (file_put_contents($filePath, json_encode($content)) === false) {
            $this->sendError('Failed to save file', 500);
            return;
        }

        $table = $this->prefix . 'planner_projects';
        
        if ($projectId) {
            $existing = $this->db->fetchRow($this->db->select()
                ->from($table)
                ->where('id = ?', $projectId)
                ->where('uid = ?', $user['uid']));
            
            if ($existing) {
                if (file_exists($existing['file_path'])) {
                    @unlink($existing['file_path']);
                }

                $this->db->query($this->db->update($table)
                    ->rows([
                        'name' => $name,
                        'description' => $description,
                        'file_path' => $filePath,
                        'updated_at' => time()
                    ])
                    ->where('id = ?', $projectId));
            } else {
                $this->sendError('Project not found or permission denied', 404);
                return;
            }
        } else {
            $this->db->query($this->db->insert($table)
                ->rows([
                    'uid' => $user['uid'],
                    'name' => $name,
                    'description' => $description,
                    'file_path' => $filePath,
                    'created_at' => time(),
                    'updated_at' => time()
                ]));
            $projectId = $this->db->lastInsertId();
        }

        $this->sendResponse(['status' => 'success', 'id' => $projectId, 'name' => $name]);
    }

    /**
     * Get Project Content
     */
    private function projectGet()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $id = isset($_GET['id']) ? intval($_GET['id']) : 0;
        if (!$id) {
            $this->sendError('ID required', 400);
            return;
        }

        $project = $this->db->fetchRow($this->db->select()
            ->from($this->prefix . 'planner_projects')
            ->where('id = ?', $id)
            ->where('uid = ?', $user['uid']));

        if (!$project) {
            $this->sendError('Project not found', 404);
            return;
        }

        if (file_exists($project['file_path'])) {
            $content = file_get_contents($project['file_path']);
            // Check if it's already JSON or double encoded
            $json = json_decode($content, true);
            // If it was a string that contained JSON, decode again
            if (is_string($json)) {
                $json = json_decode($json, true);
            }
            $this->sendResponse(['project' => $project, 'content' => $json]);
        } else {
            $this->sendError('Project file missing', 500);
        }
    }

    /**
     * Delete Project
     */
    private function projectDelete()
    {
        $user = $this->verifyToken();
        if (!$user) return;

        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        $id = isset($data['id']) ? intval($data['id']) : 0;

        if (!$id) {
            $this->sendError('ID required', 400);
            return;
        }

        $table = $this->prefix . 'planner_projects';
        $project = $this->db->fetchRow($this->db->select()
            ->from($table)
            ->where('id = ?', $id)
            ->where('uid = ?', $user['uid']));

        if ($project) {
            if (file_exists($project['file_path'])) {
                @unlink($project['file_path']);
            }
            $this->db->query($this->db->delete($table)->where('id = ?', $id));
            $this->sendResponse(['status' => 'success']);
        } else {
            $this->sendError('Project not found', 404);
        }
    }
}
