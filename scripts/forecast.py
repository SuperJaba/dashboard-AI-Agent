import os
import psycopg2
import numpy as np
import pandas as pd
import statsmodels.api as sm
from dotenv import load_dotenv

# Load database environment variables
load_dotenv()

def run_forecast():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL is not set in the environment or .env file.")
        return

    try:
        # Connect to PostgreSQL
        conn = psycopg2.connect(db_url)
        
        # Load project data
        query = """
            SELECT id, name, complete, 
                   jsonb_array_length(tasks) as total_tasks
            FROM projects;
        """
        df = pd.read_sql_query(query, conn)
        conn.close()

        if len(df) < 3:
            print("Notice: Add at least 3 projects to the database to generate regression forecasts.")
            print(f"Current project count: {len(df)}")
            return

        # Prepare variables for OLS
        # We predict the project completion percentage based on the total number of tasks
        X = df['total_tasks']
        y = df['complete']

        # Add constant for the intercept
        X = sm.add_constant(X)

        # Fit OLS model
        model = sm.OLS(y, X)
        results = model.fit()

        print("====================================================")
        print("        PROJECT TASK COMPLETION REGRESSION          ")
        print("====================================================")
        print(results.summary())
        print("====================================================")
        
        # Expose parameters
        intercept = results.params['const']
        slope = results.params['total_tasks']
        r_squared = results.rsquared

        print(f"\nModel Formula: Completion % = {intercept:.2f} + ({slope:.2f} * TotalTasks)")
        print(f"R-squared: {r_squared:.4f}")

    except Exception as e:
        print(f"Failed to run forecasting: {e}")

if __name__ == "__main__":
    run_forecast()
