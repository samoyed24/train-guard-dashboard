from app.security import hash_password, validate_access_key_credentials, validate_project_credentials, verify_password

from tests.test_support import BackendTestCase


class CreateAppUnitTestCase(BackendTestCase):
    def test_health_endpoint_returns_ok(self) -> None:
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {"status": "ok"})

    def test_init_db_command_is_registered(self) -> None:
        self.assertIn("init-db", self.app.cli.commands)


class SecurityHelpersUnitTestCase(BackendTestCase):
    def test_hash_password_round_trip(self) -> None:
        hashed = hash_password("secret123")

        self.assertNotEqual(hashed, "secret123")
        self.assertTrue(verify_password("secret123", hashed))
        self.assertFalse(verify_password("wrong-password", hashed))

    def test_validate_project_credentials_returns_project_for_valid_secret(self) -> None:
        user = self.create_user()
        project = self.create_project_record(user.id)

        with self.app.app_context():
            validated = validate_project_credentials(project.app_id, "project-secret")

        self.assertIsNotNone(validated)
        self.assertEqual(validated.id, project.id)

    def test_validate_access_key_credentials_returns_key_for_valid_secret(self) -> None:
        user = self.create_user()
        access_key = self.create_access_key_record(user.id)

        with self.app.app_context():
            validated = validate_access_key_credentials(access_key.access_key_id, "sk-demo-secret")

        self.assertIsNotNone(validated)
        self.assertEqual(validated.id, access_key.id)

