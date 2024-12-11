"""
title: Run Python Code Tool
description: This tool runs Python code in a docker sandbox
required_open_webui_version: 0.4.0
version: 1.0.0
licence: MIT
"""


from pydantic import BaseModel, Field
from typing import Optional
import uuid
import os
import subprocess
import re


class Tools:
    class Valves(BaseModel):
        show_status: bool = Field(
            default=True, description="Show status of the action."
        )

    def __init__(self):
        """Initialize the Tool with valves."""
        self.valves = self.Valves()

    async def _get_formatted_results(self, python_code: str, output: str, status: str, requirements: Optional[list] = None) -> str:
        return_string = f"The following code was executed: ```python\n{python_code}\n```\n\nThe status of the execution was: {status}"
        if requirements:
            return_string += f"\n\nThe requirements were: {requirements}"
        if output:
            return_string += f"\n\nThe output was: {output}"
        print(return_string)
        return return_string

    async def _try_detect_requirements(self, code: str) -> Optional[list]:
        if "import" in code:
            return re.findall(r'^\s*import\s+([^\s,]+)', code, re.MULTILINE) + re.findall(r'^\s*from\s+([^\s,]+)\s+import', code, re.MULTILINE)
        return None

    async def _execute_python_code(self, code: str, requirements: Optional[list] = None) -> str:
        try:
            folder_name = f"/tmp/tmp_{uuid.uuid4()}"
            os.makedirs(folder_name, exist_ok=False)
            script_name = f"{folder_name}/script.py"
            
            # Create requirements.txt if there are any requirements
            if requirements:
                requirements_file = f"{folder_name}/requirements.txt"
                with open(requirements_file, "w") as req_file:
                    req_file.write("\n".join(requirements))

            with open(script_name, "w") as f:
                f.write(code)

        
            # Install requirements if provided
            if requirements:
                result = subprocess.run(
                    ["docker", "run", "--rm", "-v", f"{folder_name}:/app", "python", "sh", "-c", "pip install --root-user-action=ignore -r /app/requirements.txt && python /app/script.py"],
                    capture_output=True,
                    text=True
                )
            else:
                result = subprocess.run(
                    ["docker", "run", "--rm", "-v", f"{folder_name}:/app", "python", "python", "/app/script.py"],
                    capture_output=True,
                    text=True
                )
            
            return_code = result.returncode
            if return_code != 0:
                return f"Error: {return_code} std_out: {result.stdout} std_err: {result.stderr}"
            return "OK: " + result.stdout
        except Exception as e:
            return f"Error: {str(e)}"
        finally:
            os.remove(script_name)
            if os.path.exists(requirements_file):
                os.remove(requirements_file)
            os.rmdir(folder_name)

    async def run_python_code(
        self,
        python_code: str,
        requirements: Optional[list] = None,
        __event_emitter__ = None,
    ) -> str:
        """
        Run Python code safely in a docker sandbox.

        Args:
            python_code: Python code to run. There should ALWAYS be 2 empty lines after the imports.
            requirements: List of requirements to install. Each requirement should be a string in the format of a requirements.txt file. For example: ["requests", "numpy", "pandas", "beautifulsoup4"]

        Returns:
            A string with the following information: `python_code`, `status`, `output`. In most cases, when `status` is "OK", the user is interested in the content of the `output` field. Otherwise, report the `status` field first. The output field starts with "OK: " when the code runs successfully or "Error: " when it fails. Always return the output field.
        """
        if __event_emitter__ is None:
            print("ERROR: Event emitter is not defined")
            return await self._get_formatted_results(python_code, "ERROR: Event emitter is not defined", "ERROR", requirements)
        
        try:
            if not requirements:
                requirements = await self._try_detect_requirements(python_code)
                print(f"Requirements: {requirements}")
            
            print(f"Running Python code: ```python\n{python_code}\n```\n\nwith requirements: {requirements}")
            
            if self.valves.show_status:
                await __event_emitter__(
                    {
                        "type": "status",
                        "data": {"description": "Processing your input", "done": True},
                    }
                )

            # Execute Python code if the input is detected as code
            code = python_code
            if code.startswith("```python") and code.endswith("```"):
                code = code[9:-3].strip()  # Remove the ```python and ``` markers

            output = await self._execute_python_code(code, requirements)
            
            if not output.startswith("Error:"):
                if self.valves.show_status:
                    await __event_emitter__(
                        {
                            "type": "status",
                            "data": {"description": "Execution completed", "done": True},
                        }
                    )
                return await self._get_formatted_results(python_code, output, "OK", requirements)

            if self.valves.show_status:
                await __event_emitter__(
                    {
                        "type": "status",
                        "data": {
                            "description": "No valid Python code detected. " + output,
                            "done": True,
                        },
                    }
                )
            
            return await self._get_formatted_results(python_code, output, "ERROR", requirements)
        except Exception as e:
            return await self._get_formatted_results(python_code, str(e), "ERROR", requirements)
        
