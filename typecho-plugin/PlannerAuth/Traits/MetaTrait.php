<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

trait PlannerAuth_Traits_MetaTrait
{
    private function updateUserMeta($uid, $key, $value)
    {
        $table = $this->prefix . 'planner_usermeta';
        $existing = $this->db->fetchRow($this->db->select()
            ->from($table)
            ->where('uid = ?', $uid)
            ->where('meta_key = ?', $key));

        if ($existing) {
            $this->db->query($this->db->update($table)
                ->rows(['meta_value' => $value])
                ->where('id = ?', $existing['id']));
        } else {
            $this->db->query($this->db->insert($table)
                ->rows([
                    'uid' => $uid,
                    'meta_key' => $key,
                    'meta_value' => $value
                ]));
        }
    }

    private function getUserMeta($uid)
    {
        $rows = $this->db->fetchAll($this->db->select()
            ->from($this->prefix . 'planner_usermeta')
            ->where('uid = ?', $uid));
            
        $meta = [];
        foreach ($rows as $row) {
            $meta[$row['meta_key']] = $row['meta_value'];
        }
        return $meta;
    }
}
