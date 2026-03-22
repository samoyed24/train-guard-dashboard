import unittest

from app import create_app


class CreateAppTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.app = create_app()
        self.client = self.app.test_client()

    def test_health_endpoint_returns_ok(self) -> None:
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {"status": "ok"})

    def test_init_db_command_is_registered(self) -> None:
        self.assertIn("init-db", self.app.cli.commands)
