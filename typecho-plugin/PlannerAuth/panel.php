<?php
include 'header.php';
include 'menu.php';

$db = Typecho_Db::get();
$prefix = $db->getPrefix();
$options = Typecho_Widget::widget('Widget_Options');

// Permission Check
if (!Typecho_Widget::widget('Widget_User')->pass('administrator')) {
    throw new Typecho_Widget_Exception(_t('Access Denied'), 403);
}

// Current Tab
$tab = isset($_GET['tab']) ? $_GET['tab'] : 'users';

// --- Actions ---

// Update User Role
if (isset($_POST['do']) && $_POST['do'] == 'update_role') {
    $uid = intval($_POST['uid']);
    $role = $_POST['role'];
    
    // Check if meta exists
    $exist = $db->fetchRow($db->select()->from($prefix . 'planner_usermeta')
        ->where('uid = ?', $uid)->where('meta_key = ?', 'planner_role'));
        
    if ($exist) {
        $db->query($db->update($prefix . 'planner_usermeta')
            ->rows(['meta_value' => $role])
            ->where('id = ?', $exist['id']));
    } else {
        $db->query($db->insert($prefix . 'planner_usermeta')
            ->rows([
                'uid' => $uid, 
                'meta_key' => 'planner_role',
                'meta_value' => $role
            ]));
    }
    
    Typecho_Widget::widget('Widget_Notice')->set(_t('User role updated successfully'), 'success');
    Typecho_Response::redirect($options->adminUrl . 'extending.php?panel=PlannerAuth%2Fpanel.php&tab=users');
}

// Save System Config
if (isset($_POST['do']) && $_POST['do'] == 'save_config') {
    $configJson = $_POST['sys_config'];
    
    // Validate JSON
    $decoded = json_decode($configJson);
    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
        Typecho_Widget::widget('Widget_Notice')->set(_t('Invalid JSON format'), 'error');
    } else {
        // Save
        $row = $db->fetchRow($db->select('value')->from('table.options')->where('name = ?', 'planner_system_config'));
        if ($row) {
            $db->query($db->update('table.options')->rows(['value' => $configJson])->where('name = ?', 'planner_system_config'));
        } else {
            $db->query($db->insert('table.options')->rows(['name' => 'planner_system_config', 'user' => 0, 'value' => $configJson]));
        }
        Typecho_Widget::widget('Widget_Notice')->set(_t('System configuration saved'), 'success');
    }
    Typecho_Response::redirect($options->adminUrl . 'extending.php?panel=PlannerAuth%2Fpanel.php&tab=settings');
}

// Delete File
if (isset($_POST['do']) && $_POST['do'] == 'delete_file') {
    $path = $_POST['path'];
    // Security Check: path must be inside uploads
    $realUploads = realpath(__TYPECHO_ROOT_DIR__ . '/usr/uploads');
    $realTarget = realpath($path);
    
    if ($realTarget && strpos($realTarget, $realUploads) === 0 && file_exists($realTarget)) {
        unlink($realTarget);
        Typecho_Widget::widget('Widget_Notice')->set(_t('File deleted'), 'success');
    } else {
        Typecho_Widget::widget('Widget_Notice')->set(_t('Invalid file path or permission denied'), 'error');
    }
    Typecho_Response::redirect($options->adminUrl . 'extending.php?panel=PlannerAuth%2Fpanel.php&tab=files');
}

// Delete Project
if (isset($_POST['do']) && $_POST['do'] == 'delete_project') {
    $pid = intval($_POST['pid']);
    $project = $db->fetchRow($db->select()->from($prefix . 'planner_projects')->where('id = ?', $pid));
    
    if ($project) {
        // Delete file
        if (file_exists($project['file_path'])) {
            @unlink($project['file_path']);
        }
        // Delete DB record
        $db->query($db->delete($prefix . 'planner_projects')->where('id = ?', $pid));
        Typecho_Widget::widget('Widget_Notice')->set(_t('Project deleted'), 'success');
    } else {
        Typecho_Widget::widget('Widget_Notice')->set(_t('Project not found'), 'error');
    }
    Typecho_Response::redirect($options->adminUrl . 'extending.php?panel=PlannerAuth%2Fpanel.php&tab=projects');
}

?>

<div class="main">
    <div class="body container">
        <div class="typecho-page-title">
            <h2><?php _e('Planner System Management'); ?></h2>
        </div>
        
        <div class="row typecho-page-main" role="main">
            
            <div class="col-mb-12">
                <ul class="typecho-option-tabs fix-tabs clearfix">
                    <li class="<?php if($tab == 'users') echo 'current'; ?>">
                        <a href="<?php echo $options->adminUrl('extending.php?panel=PlannerAuth%2Fpanel.php&tab=users'); ?>"><?php _e('User Management'); ?></a>
                    </li>
                    <li class="<?php if($tab == 'projects') echo 'current'; ?>">
                        <a href="<?php echo $options->adminUrl('extending.php?panel=PlannerAuth%2Fpanel.php&tab=projects'); ?>"><?php _e('Projects'); ?></a>
                    </li>
                    <li class="<?php if($tab == 'files') echo 'current'; ?>">
                        <a href="<?php echo $options->adminUrl('extending.php?panel=PlannerAuth%2Fpanel.php&tab=files'); ?>"><?php _e('File Management'); ?></a>
                    </li>
                    <li class="<?php if($tab == 'settings') echo 'current'; ?>">
                        <a href="<?php echo $options->adminUrl('extending.php?panel=PlannerAuth%2Fpanel.php&tab=settings'); ?>"><?php _e('System Configuration'); ?></a>
                    </li>
                </ul>
            </div>

            <div class="col-mb-12 typecho-list-operate">
                
                <?php if ($tab == 'users'): ?>
                    <?php
                    // Fetch Users with Usage Stats
                    $users = $db->fetchAll($db->select('table.users.uid', 'table.users.name', 'table.users.screenName', 'table.users.mail', 'table.users.group')
                        ->from('table.users')
                        ->order('table.users.uid', Typecho_Db::SORT_ASC));

                    // Fetch Roles
                    $metas = [];
                    $rows = $db->fetchAll($db->select()->from($prefix . 'planner_usermeta')->where('meta_key = ?', 'planner_role'));
                    foreach ($rows as $row) {
                        $metas[$row['uid']] = $row['meta_value'];
                    }
                    
                    // Fetch Usage Stats (Group by UID)
                    $stats = [];
                    try {
                        $statRows = $db->fetchAll($db->select('uid', 'COUNT(id) as p_count', 'SUM(activity_count) as a_count', 'SUM(resource_count) as r_count')
                            ->from($prefix . 'planner_projects')
                            ->group('uid'));
                        foreach ($statRows as $row) {
                            $stats[$row['uid']] = $row;
                        }
                    } catch (Exception $e) {
                        // Table might be missing columns if upgrade failed
                    }
                    ?>
                    <table class="typecho-list-table striped hover">
                        <colgroup>
                            <col width="5%"/>
                            <col width="15%"/>
                            <col width="15%"/>
                            <col width="10%"/>
                            <col width="15%"/>
                            <col width="25%"/>
                            <col width="15%"/>
                        </colgroup>
                        <thead>
                            <tr>
                                <th>UID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Group</th>
                                <th>Role</th>
                                <th>Usage (Proj / Act / Res)</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($users as $user): ?>
                            <?php 
                                $uid = $user['uid'];
                                $role = isset($metas[$uid]) ? $metas[$uid] : 'trial';
                                // Auto-map
                                if ($role == 'trial') {
                                    if ($user['group'] == 'contributor') $role = 'licensed';
                                    if ($user['group'] == 'editor') $role = 'premium';
                                    if ($user['group'] == 'administrator') $role = 'admin';
                                }
                                
                                $uStat = isset($stats[$uid]) ? $stats[$uid] : ['p_count'=>0, 'a_count'=>0, 'r_count'=>0];
                            ?>
                            <tr>
                                <td><?php echo $uid; ?></td>
                                <td><?php echo $user['screenName'] ? $user['screenName'] : $user['name']; ?></td>
                                <td><?php echo $user['mail']; ?></td>
                                <td><?php echo $user['group']; ?></td>
                                <td>
                                    <span class="message <?php echo ($role=='admin'||$role=='premium')?'success':''; ?>">
                                        <?php echo ucfirst($role); ?>
                                    </span>
                                </td>
                                <td>
                                    <?php echo intval($uStat['p_count']); ?> / 
                                    <?php echo intval($uStat['a_count']); ?> / 
                                    <?php echo intval($uStat['r_count']); ?>
                                </td>
                                <td>
                                    <form method="post" action="<?php echo $options->adminUrl('extending.php?panel=PlannerAuth%2Fpanel.php&tab=users'); ?>" style="display:inline;">
                                        <input type="hidden" name="do" value="update_role" />
                                        <input type="hidden" name="uid" value="<?php echo $uid; ?>" />
                                        <select name="role" onchange="this.form.submit()" style="width:100px; padding:2px;">
                                            <option value="trial" <?php if($role=='trial') echo 'selected'; ?>>Trial</option>
                                            <option value="licensed" <?php if($role=='licensed') echo 'selected'; ?>>Licensed</option>
                                            <option value="premium" <?php if($role=='premium') echo 'selected'; ?>>Premium</option>
                                            <option value="admin" <?php if($role=='admin') echo 'selected'; ?>>Admin</option>
                                        </select>
                                    </form>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>

                <?php elseif ($tab == 'projects'): ?>
                    <?php
                    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
                    
                    $query = $db->select('p.*', 'u.screenName', 'u.name as username')
                        ->from($prefix . 'planner_projects', 'p')
                        ->join('table.users', 'p.uid = u.uid', 'u')
                        ->order('p.updated_at', Typecho_Db::SORT_DESC);
                        
                    if ($search) {
                        $query->where('p.name LIKE ? OR u.screenName LIKE ? OR u.name LIKE ?', "%$search%", "%$search%", "%$search%");
                    }
                    
                    $projects = $db->fetchAll($query);
                    ?>
                    
                    <div class="typecho-list-operate clearfix">
                        <form method="get">
                            <input type="hidden" name="panel" value="PlannerAuth/panel.php" />
                            <input type="hidden" name="tab" value="projects" />
                            <div class="search" role="search">
                                <input type="text" class="text-s" placeholder="<?php _e('Search project or user'); ?>" value="<?php echo htmlspecialchars($search); ?>" name="search" />
                                <button type="submit" class="btn btn-s"><?php _e('Search'); ?></button>
                            </div>
                        </form>
                    </div>

                    <table class="typecho-list-table striped hover">
                        <colgroup>
                            <col width="5%"/>
                            <col width="20%"/>
                            <col width="15%"/>
                            <col width="15%"/>
                            <col width="15%"/>
                            <col width="15%"/>
                            <col width="15%"/>
                        </colgroup>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Project Name</th>
                                <th>User</th>
                                <th>Activities / Resources</th>
                                <th>Created</th>
                                <th>Updated</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php if(empty($projects)): ?>
                            <tr><td colspan="7"><h6 class="typecho-list-table-title"><?php _e('No projects found'); ?></h6></td></tr>
                            <?php else: ?>
                            <?php foreach ($projects as $proj): ?>
                            <?php
                                // Construct download URL
                                $downloadUrl = Typecho_Common::url('/usr/uploads/planner_projects/' . basename($proj['file_path']), $options->siteUrl);
                            ?>
                            <tr>
                                <td><?php echo $proj['id']; ?></td>
                                <td><?php echo htmlspecialchars($proj['name']); ?></td>
                                <td><?php echo htmlspecialchars($proj['screenName'] ? $proj['screenName'] : $proj['username']); ?></td>
                                <td><?php echo intval($proj['activity_count']); ?> / <?php echo intval($proj['resource_count']); ?></td>
                                <td><?php echo date('Y-m-d', $proj['created_at']); ?></td>
                                <td><?php echo date('Y-m-d H:i', $proj['updated_at']); ?></td>
                                <td>
                                    <a href="<?php echo $downloadUrl; ?>" target="_blank" class="btn btn-xs btn-primary" download><?php _e('Download'); ?></a>
                                    <form method="post" action="<?php echo $options->adminUrl('extending.php?panel=PlannerAuth%2Fpanel.php&tab=projects'); ?>" style="display:inline;" onsubmit="return confirm('<?php _e('Are you sure you want to delete this project?'); ?>');">
                                        <input type="hidden" name="do" value="delete_project" />
                                        <input type="hidden" name="pid" value="<?php echo $proj['id']; ?>" />
                                        <button type="submit" class="btn btn-xs btn-warn"><?php _e('Delete'); ?></button>
                                    </form>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>

                <?php elseif ($tab == 'files'): ?>
                    <?php
                    // List files in planner_projects directory
                    $uploadDir = __TYPECHO_ROOT_DIR__ . '/usr/uploads/planner_projects/';
                    $files = [];
                    if (is_dir($uploadDir)) {
                        $scan = scandir($uploadDir);
                        foreach ($scan as $f) {
                            if ($f == '.' || $f == '..') continue;
                            $files[] = [
                                'name' => $f,
                                'path' => $uploadDir . $f,
                                'size' => filesize($uploadDir . $f),
                                'time' => filemtime($uploadDir . $f)
                            ];
                        }
                    }
                    ?>
                    <table class="typecho-list-table striped hover">
                        <colgroup>
                            <col width="40%"/>
                            <col width="20%"/>
                            <col width="20%"/>
                            <col width="20%"/>
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Filename</th>
                                <th>Size</th>
                                <th>Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($files as $file): ?>
                            <tr>
                                <td><?php echo $file['name']; ?></td>
                                <td><?php echo number_format($file['size'] / 1024, 2); ?> KB</td>
                                <td><?php echo date('Y-m-d H:i', $file['time']); ?></td>
                                <td>
                                    <form method="post" action="<?php echo $options->adminUrl('extending.php?panel=PlannerAuth%2Fpanel.php&tab=files'); ?>" style="display:inline;" onsubmit="return confirm('<?php _e('Are you sure?'); ?>');">
                                        <input type="hidden" name="do" value="delete_file" />
                                        <input type="hidden" name="path" value="<?php echo $file['path']; ?>" />
                                        <button type="submit" class="btn btn-xs btn-warn"><?php _e('Delete'); ?></button>
                                    </form>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>

                <?php elseif ($tab == 'settings'): ?>
                    <?php
                    $config = '';
                    $row = $db->fetchRow($db->select('value')->from('table.options')->where('name = ?', 'planner_system_config'));
                    if ($row) {
                        // Pretty print JSON
                        $json = json_decode($row['value']);
                        if ($json) {
                            $config = json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                        } else {
                            $config = $row['value'];
                        }
                    } else {
                         // Default Config
                         $default = [
                             'allow_registration' => true,
                             'max_file_size_mb' => 10,
                             'support_email' => 'support@example.com'
                         ];
                         $config = json_encode($default, JSON_PRETTY_PRINT);
                    }
                    ?>
                    <form method="post" action="<?php echo $options->adminUrl('extending.php?panel=PlannerAuth%2Fpanel.php&tab=settings'); ?>">
                        <input type="hidden" name="do" value="save_config" />
                        <ul class="typecho-option typecho-option-submit">
                            <li>
                                <label class="typecho-label" for="sys_config"><?php _e('Global Configuration (JSON)'); ?></label>
                                <textarea name="sys_config" id="sys_config" rows="15" class="w-100 mono"><?php echo htmlspecialchars($config); ?></textarea>
                                <p class="description"><?php _e('Configure global settings for the Planner application in JSON format.'); ?></p>
                            </li>
                        </ul>
                        <button type="submit" class="btn primary"><?php _e('Save Configuration'); ?></button>
                    </form>

                <?php endif; ?>
            </div>
        </div>
    </div>
</div>

<?php
include 'copyright.php';
include 'common-js.php';
include 'footer.php';
?>