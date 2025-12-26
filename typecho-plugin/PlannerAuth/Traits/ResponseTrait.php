<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

trait PlannerAuth_Traits_ResponseTrait
{
    private function sendResponse($data)
    {
        echo json_encode($data);
        exit;
    }

    private function sendError($message, $code = 400)
    {
        http_response_code($code);
        echo json_encode(['error' => $message]);
        exit;
    }
}
