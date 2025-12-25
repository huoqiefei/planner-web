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

// Handle Update
if (isset($_POST['do']) && $_POST['do'] == 'update') {
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
    Typecho_Response::redirect(Typecho_Common::url('extending.php?panel=PlannerAuth%2Fpanel.php', $options->adminUrl));
}

// Fetch Users
$users = $db->fetchAll($db->select('table.users.uid', 'table.users.name', 'table.users.screenName', 'table.users.mail', 'table.users.group')
    ->from('table.users')
    ->order('table.users.uid', Typecho_Db::SORT_ASC));

// Fetch Metas
$metas = [];
$rows = $db->fetchAll($db->select()->from($prefix . 'planner_usermeta')->where('meta_key = ?', 'planner_role'));
foreach ($rows as $row) {
    $metas[$row['uid']] = $row['meta_value'];
}
?>

<div class="main">
    <div class="body container">
        <div class="typecho-page-title">
            <h2><?php _e('Planner Authorization Management'); ?></h2>
        </div>
        <div class="row typecho-page-main" role="main">
            <div class="col-mb-12">
                <table class="typecho-list-table striped hover">
                    <colgroup>
                        <col width="10%"/>
                        <col width="20%"/>
                        <col width="20%"/>
                        <col width="15%"/>
                        <col width="15%"/>
                        <col width="20%"/>
                    </colgroup>
                    <thead>
                        <tr>
                            <th>UID</th>
                            <th>Username</th>
                            <th>Screen Name</th>
                            <th>Group</th>
                            <th>Current Role</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($users as $user): ?>
                        <?php 
                            $role = isset($metas[$user['uid']]) ? $metas[$user['uid']] : 'trial';
                            // Auto-map if trial
                            if ($role == 'trial') {
                                if ($user['group'] == 'contributor') $role = 'licensed';
                                if ($user['group'] == 'editor') $role = 'premium';
                                if ($user['group'] == 'administrator') $role = 'admin';
                            }
                        ?>
                        <tr>
                            <td><?php echo $user['uid']; ?></td>
                            <td><?php echo $user['name']; ?></td>
                            <td><?php echo $user['screenName']; ?></td>
                            <td><?php echo $user['group']; ?></td>
                            <td>
                                <?php 
                                    $labels = [
                                        'trial' => 'Trial (Subscriber)',
                                        'licensed' => 'Licensed (Contributor)',
                                        'premium' => 'Premium (Editor)',
                                        'admin' => 'Admin (Administrator)'
                                    ];
                                    echo isset($labels[$role]) ? $labels[$role] : $role;
                                ?>
                            </td>
                            <td>
                                <form method="post" action="<?php echo $options->adminUrl('extending.php?panel=PlannerAuth%2Fpanel.php'); ?>">
                                    <input type="hidden" name="do" value="update" />
                                    <input type="hidden" name="uid" value="<?php echo $user['uid']; ?>" />
                                    <select name="role" onchange="this.form.submit()">
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
            </div>
        </div>
    </div>
</div>

<?php
include 'copyright.php';
include 'common-js.php';
include 'footer.php';
?>