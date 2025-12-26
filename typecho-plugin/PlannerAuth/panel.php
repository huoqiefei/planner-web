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

                <?php elseif ($tab == 'files'): ?>
                    <?php
                        // Helper to scan directory
                        function getFiles($dir, $type) {
                            $files = [];
                            if (is_dir($dir)) {
                                $scan = scandir($dir);
                                foreach ($scan as $f) {
                                    if ($f == '.' || $f == '..') continue;
                                    $path = $dir . '/' . $f;
                                    if (is_file($path)) {
                                        $files[] = [
                                            'name' => $f,
                                            'path' => $path,
                                            'size' => filesize($path),
                                            'time' => filemtime($path),
                                            'type' => $type
                                        ];
                                    }
                                }
                            }
                            return $files;
                        }

                        $projectFiles = getFiles(__TYPECHO_ROOT_DIR__ . '/usr/uploads/planner_projects', 'Project');
                        $avatarFiles = getFiles(__TYPECHO_ROOT_DIR__ . '/usr/uploads/avatars', 'Avatar');
                        $allFiles = array_merge($projectFiles, $avatarFiles);
                        
                        // Sort by time desc
                        usort($allFiles, function($a, $b) {
                            return $b['time'] - $a['time'];
                        });
                    ?>
                    <table class="typecho-list-table striped hover">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Filename</th>
                                <th>Size</th>
                                <th>Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($allFiles as $file): ?>
                            <tr>
                                <td><?php echo $file['type']; ?></td>
                                <td><?php echo $file['name']; ?></td>
                                <td><?php echo round($file['size'] / 1024, 2); ?> KB</td>
                                <td><?php echo date('Y-m-d H:i:s', $file['time']); ?></td>
                                <td>
                                    <form method="post" action="<?php echo $options->adminUrl('extending.php?panel=PlannerAuth%2Fpanel.php&tab=files'); ?>" onsubmit="return confirm('Delete this file?');">
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
                        $row = $db->fetchRow($db->select('value')->from('table.options')->where('name = ?', 'planner_system_config'));
                        $configValue = $row ? $row['value'] : "{\n\t\"appName\": \"Planner\",\n\t\"copyrightText\": \"© 2024 Planner\",\n\t\"enableWatermark\": false\n}";
                        // Prettify if possible
                        $decoded = json_decode($configValue);
                        if ($decoded) {
                            $configValue = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
                        }
                    ?>
                    <form method="post" action="<?php echo $options->adminUrl('extending.php?panel=PlannerAuth%2Fpanel.php&tab=settings'); ?>">
                        <input type="hidden" name="do" value="save_config" />
                        <p>
                            <label for="sys_config" class="typecho-label"><?php _e('System Configuration (JSON)'); ?></label>
                            <textarea name="sys_config" id="sys_config" style="width: 100%; height: 400px; font-family: monospace; font-size: 14px; background: #f9f9f9; border: 1px solid #ddd; padding: 10px;"><?php echo htmlspecialchars($configValue); ?></textarea>
                        </p>
                        <p class="submit">
                            <button type="submit" class="btn primary"><?php _e('Save Configuration'); ?></button>
                        </p>
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
