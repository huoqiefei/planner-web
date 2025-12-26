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
        // Debug Log
        $this->log("projectSave called");

        // Suppress PHP errors to avoid corrupting JSON output, but log them?
        // ini_set('display_errors', 0); 
        
        try {
            $user = $this->verifyToken();
            if (!$user) {
                $this->log("projectSave: Token verification failed");
                return; // verifyToken already sends error
            }

            $input = file_get_contents('php://input');
            if (!$input) {
                $this->log("projectSave: No input received");
                $this->sendError('No input received', 400);
                return;
            }
            
            $this->log("projectSave: Input length: " . strlen($input));

            $data = json_decode($input, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->log("projectSave: JSON decode error: " . json_last_error_msg());
                $this->sendError('Invalid JSON: ' . json_last_error_msg(), 400);
                return;
            }
            
            $name = isset($data['name']) ? $data['name'] : 'Untitled Project';
            $description = isset($data['description']) ? $data['description'] : '';
            $content = isset($data['content']) ? $data['content'] : [];
            $projectId = isset($data['id']) ? intval($data['id']) : null;

            if (empty($content)) {
                $this->log("projectSave: Empty content");
                $this->sendError('Project content is empty', 400);
                return;
            }

            // Calculate Stats
            $activityCount = 0;
            $resourceCount = 0;
            
            if (isset($content['activities']) && is_array($content['activities'])) {
                $activityCount = count($content['activities']);
            }
            if (isset($content['resources']) && is_array($content['resources'])) {
                $resourceCount = count($content['resources']);
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
                    $this->log("projectSave: Limit reached for user {$user['uid']} ({$plannerRole})");
                    $this->sendError("Project limit reached for your account type ({$plannerRole}). Limit: {$limit}", 403);
                    return;
                }
            }

            $uploadDir = __TYPECHO_ROOT_DIR__ . '/usr/uploads/planner_projects/';
            if (!is_dir($uploadDir)) {
                if (!mkdir($uploadDir, 0755, true)) {
                    $this->log("projectSave: Failed to create upload directory: $uploadDir");
                    $this->sendError('Failed to create upload directory', 500);
                    return;
                }
            }

            $fileName = $user['uid'] . '_' . time() . '_' . uniqid() . '.json';
            $filePath = $uploadDir . $fileName;

            $jsonContent = json_encode($content);
            if ($jsonContent === false) {
                 $this->log("projectSave: JSON encode failed: " . json_last_error_msg());
                 $this->sendError('Failed to encode project data', 500);
                 return;
            }

            if (file_put_contents($filePath, $jsonContent) === false) {
                $this->log("projectSave: Failed to write file: $filePath");
                $this->sendError('Failed to save file', 500);
                return;
            }
            
            // Database Record
            $projectData = [
                'uid' => $user['uid'],
                'name' => $name,
                'description' => $description,
                'file_path' => 'usr/uploads/planner_projects/' . $fileName,
                'activity_count' => $activityCount,
                'resource_count' => $resourceCount,
                'updated_at' => time()
            ];

            if ($projectId) {
                // Update existing project
                // Verify ownership
                $existing = $this->db->fetchRow($this->db->select()
                    ->from($this->prefix . 'planner_projects')
                    ->where('id = ?', $projectId)
                    ->where('uid = ?', $user['uid']));

                if (!$existing) {
                    $this->log("projectSave: Project not found or access denied. ID: $projectId, UID: {$user['uid']}");
                    $this->sendError('Project not found or access denied', 404);
                    // Clean up file
                    unlink($filePath);
                    return;
                }

                // Delete old file
                $oldFile = __TYPECHO_ROOT_DIR__ . '/' . $existing['file_path'];
                if (file_exists($oldFile)) {
                    unlink($oldFile);
                }

                $this->db->query($this->db->update($this->prefix . 'planner_projects')
                    ->rows($projectData)
                    ->where('id = ?', $projectId));
            } else {
                // Create new project
                $projectData['created_at'] = time();
                $this->db->query($this->db->insert($this->prefix . 'planner_projects')
                    ->rows($projectData));
                $projectId = $this->db->lastInsertId();
            }
            
            // Update User Usage Stats
            $this->updateUserUsage($user['uid']);

            $this->log("projectSave: Success. ID: $projectId");
            $this->sendResponse(['id' => $projectId, 'status' => 'success']);
        
        } catch (Exception $e) {
            $this->log("projectSave: Exception: " . $e->getMessage());
            $this->sendError('Server Error: ' . $e->getMessage(), 500);
        }
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
